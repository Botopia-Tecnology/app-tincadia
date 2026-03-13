import * as Contacts from 'expo-contacts';
import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

export interface DeviceContact {
  id: string;
  name: string;
  phoneNumbers: string[];
}

export interface ContactMatch {
  contact: string;
  isOnTincadia: boolean;
  userId?: string;
}

export interface ChunkResponse {
  matches: ContactMatch[];
  acceptedChunkIndex: number;
  nextRecommendedDelayMs: number;
}

export async function requestContactsPermission(): Promise<boolean> {
  const { status: existingStatus } = await Contacts.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.getPermissionsAsync();
  return status === 'granted';
}

export async function getDeviceContacts(): Promise<DeviceContact[]> {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) throw new Error('Contacts permission not granted');

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  return data
    .filter((c) => c.phoneNumbers?.length)
    .map((c) => ({
      id: c.id || '',
      name: c.name || 'Sin nombre',
      phoneNumbers: (c.phoneNumbers || [])
        .map((p) => normalizePhone(p.number || ''))
        .filter(Boolean),
    }));
}

function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle Colombian numbers: remove country code 57 if present
  if (digits.startsWith('57') && digits.length > 10) {
    digits = digits.slice(2);
  }

  // Handle numbers starting with 0 (some formats)
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  // Return last 10 digits (standard mobile number length in Colombia)
  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits;
}

export async function getAllPhoneNumbers(): Promise<string[]> {
  const hasPermission = await requestContactsPermission();
  if (!hasPermission) return [];

  // Get RAW contacts directly to avoid pre-normalization data loss
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers],
  });

  const phoneSet = new Set<string>();

  for (const c of data) {
    if (!c.phoneNumbers) continue;

    for (const p of c.phoneNumbers) {
      const raw = p.number;
      if (!raw) continue;

      // Clean: keep digits and + only
      const clean = raw.replace(/[^0-9+]/g, '');
      if (clean.length < 7) continue; // Skip too short

      // Variation 1: The cleaned raw number (e.g. +573001234567 or 3001234567)
      phoneSet.add(clean);

      // Digits only version
      const digits = clean.replace(/\D/g, '');
      if (digits !== clean) phoneSet.add(digits); // Add 57300... if input was +57300...

      // Colombian Logic
      // Case A: Has country code 57 (12 digits)
      if (digits.startsWith('57') && digits.length === 12) {
        // Add without 57 (300...)
        phoneSet.add(digits.slice(2));
        // Ensure + version exists
        phoneSet.add('+' + digits);
      }

      // Case B: Local 10 digits
      if (digits.length === 10) {
        // Add 57 prefix
        phoneSet.add('57' + digits);
        // Add +57 prefix
        phoneSet.add('+57' + digits);
      }

      // Case C: Has +57 prefix already
      if (clean.startsWith('+57') && clean.length === 13) {
        const noPlus = clean.slice(1); // 57300...
        const local = clean.slice(3);  // 300...
        phoneSet.add(noPlus);
        phoneSet.add(local);
      }
    }
  }

  return Array.from(phoneSet);
}

export class ContactsSyncManager {
  private batchId: string | null = null;
  private chunkSize = 100;
  private throttleMs = 60000;

  async start(syncMode: 'full' | 'delta' = 'full', deviceId?: string) {
    const response = await apiClient<{ batchId: string; chunkSize: number; throttleMs: number }>(
      API_ENDPOINTS.CONTACTS_SYNC_START,
      { method: 'POST', body: JSON.stringify({ syncMode, deviceId }) }
    );
    this.batchId = response.batchId;
    this.chunkSize = response.chunkSize;
    this.throttleMs = response.throttleMs;
    return response;
  }

  async sendChunk(contacts: string[], chunkIndex: number, cursorAfterChunk?: number): Promise<ChunkResponse> {
    if (!this.batchId) throw new Error('Sync not started');
    return apiClient<ChunkResponse>(API_ENDPOINTS.CONTACTS_SYNC_CHUNK, {
      method: 'POST',
      body: JSON.stringify({ batchId: this.batchId, chunkIndex, contacts, cursorAfterChunk }),
    });
  }

  async complete(finalCursor?: number) {
    if (!this.batchId) throw new Error('Sync not started');
    const response = await apiClient<{ ok: boolean }>(API_ENDPOINTS.CONTACTS_SYNC_COMPLETE, {
      method: 'POST',
      body: JSON.stringify({ batchId: this.batchId, finalCursor }),
    });
    this.batchId = null;
    return response;
  }

  async syncAllContacts(
    onProgress?: (p: { current: number; total: number; matches: ContactMatch[] }) => void
  ): Promise<ContactMatch[]> {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) throw new Error('Contacts permission not granted');

    const phoneNumbers = await getAllPhoneNumbers();
    console.log('📱 Device contacts found (phones):', phoneNumbers.length);
    if (!phoneNumbers.length) return [];

    const startInfo = await this.start('full');
    console.log('🚀 Sync started:', startInfo);

    const allMatches: ContactMatch[] = [];
    const totalChunks = Math.ceil(phoneNumbers.length / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, phoneNumbers.length);
      const chunk = phoneNumbers.slice(start, end);

      console.log(`📡 Sending chunk ${i + 1}/${totalChunks} size: ${chunk.length}`);

      try {
        const response = await this.sendChunk(chunk, i, end);
        const validMatches = response.matches.filter(m => m.isOnTincadia).length;
        console.log(`✅ Chunk ${i + 1} response: ${response.matches.length} processed, ${validMatches} ON TINCADIA`);

        allMatches.push(...response.matches);
        onProgress?.({ current: end, total: phoneNumbers.length, matches: response.matches });

        if (i < totalChunks - 1) {
          console.log(`⏳ Waiting ${response.nextRecommendedDelayMs}ms...`);
          await new Promise((r) => setTimeout(r, response.nextRecommendedDelayMs));
        }
      } catch (err) {
        console.error(`❌ Error sending chunk ${i}:`, err);
      }
    }

    await this.complete(phoneNumbers.length);
    console.log('🏁 Sync complete. Total matches:', allMatches.length);
    return allMatches;
  }
}

export const deviceContactsService = {
  requestPermission: requestContactsPermission,
  hasPermission: hasContactsPermission,
  getContacts: getDeviceContacts,
  getAllPhoneNumbers,
  createSyncManager: () => new ContactsSyncManager(),
};
