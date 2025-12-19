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
  const contacts = await getDeviceContacts();
  const phoneSet = new Set<string>();
  for (const c of contacts) {
    for (const phone of c.phoneNumbers) {
      if (phone) phoneSet.add(phone);
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
    if (!phoneNumbers.length) return [];

    await this.start('full');
    const allMatches: ContactMatch[] = [];
    const totalChunks = Math.ceil(phoneNumbers.length / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, phoneNumbers.length);
      const response = await this.sendChunk(phoneNumbers.slice(start, end), i, end);
      allMatches.push(...response.matches);
      onProgress?.({ current: end, total: phoneNumbers.length, matches: response.matches });
      if (i < totalChunks - 1) await new Promise((r) => setTimeout(r, response.nextRecommendedDelayMs));
    }

    await this.complete(phoneNumbers.length);
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
