import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Alert, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { deviceContactsService } from '../services/device-contacts.service';
import { Conversation } from '../types/chat.types';
import { appNotificationService } from '../services/appNotification.service';
import { useContactsSync } from './useContactsSync';
import { API_URL } from '../config/api.config';
import {
  getConversations as getLocalConversations,
  getLocalContacts,
  saveContact,
  saveConversation,
  getConversation,
  patchConversationMetadata,
  shouldSync,
  updateSyncTime,
  updateConversationPreview,
  deleteConversation as localDeleteConversation,
} from '../database/chatDatabase';

/** Realtime/API payloads may use snake_case or camelCase; UUIDs may differ in casing. */
function isSameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function parseMessageRowMetadata(row: Record<string, unknown>): Record<string, unknown> | null {
  const raw = row.metadata;
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export interface ChatListItem {
  id: string;
  type: 'contact' | 'unknown' | 'synced' | 'group';
  displayName: string;
  phone: string;
  otherUserId: string;
  conversationId?: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  contactId?: string;
  alias?: string;
  customFirstName?: string;
  customLastName?: string;
  avatarUrl?: string;
  description?: string;
}

export const useChatList = (userId: string) => {
  const [chatItems, setChatItems] = useState<ChatListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'contacts' | 'groups'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state
  const { isSyncing, progress, startSync, error: syncError } = useContactsSync();
  const [showSyncBanner, setShowSyncBanner] = useState(true);
  const [syncResult, setSyncResult] = useState<{ found: number; total: number } | null>(null);
  const [syncedContacts, setSyncedContacts] = useState<ChatListItem[]>([]);

  // Notifications state
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const SYNCED_CONTACTS_KEY = `@synced_contacts_${userId}`; // Only used for cleanup of legacy storage

  // Deduplication for real-time messages
  const recentMessageIdsRef = useRef<Set<string>>(new Set());
  const wasDisconnectedRef = useRef(false);

  // Transform helper
  const transformToItems = useCallback((
    contacts: Contact[],
    conversations: Conversation[]
  ): ChatListItem[] => {
    const contactsByUserId = new Map(contacts.filter(c => c.contactUserId).map(c => [c.contactUserId, c]));
    const contactsByPhone = new Map(contacts.filter(c => c.phone).map(c => [c.phone.replace(/\D/g, ''), c]));

    // Deduplicate direct conversations by otherUserId (keep most recent)
    const deduped = new Map<string, Conversation>();
    conversations.forEach(conv => {
      const isGroup = conv.isGroup || conv.type === 'group';
      if (isGroup) {
        deduped.set(conv.id, conv);
        return;
      }
      const key = conv.otherUserId || conv.id;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, conv);
      } else {
        const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const currentTime = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
        if (currentTime > existingTime) {
          deduped.set(key, conv);
        }
      }
    });
    const uniqueConversations = Array.from(deduped.values());
    const conversationsByUserId = new Map(uniqueConversations.map(conv => [conv.otherUserId, conv]));

    const normalizeUrl = (url?: string) => {
      if (!url) return undefined;
      if (url.startsWith('http')) return url;
      return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const items: ChatListItem[] = uniqueConversations.map(conv => {
      const isGroup = conv.isGroup || conv.type === 'group';
      if (isGroup) {
        return {
          id: conv.id,
          type: 'group' as const,
          displayName: conv.title || conv.otherUserName || 'Grupo',
          phone: '',
          otherUserId: '',
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          avatarUrl: normalizeUrl(conv.imageUrl || conv.otherUserAvatar),
          description: conv.description,
        };
      }

      let contact = contactsByUserId.get(conv.otherUserId);
      if (!contact && conv.otherUserPhone) {
        const normalizedPhone = conv.otherUserPhone.replace(/\D/g, '');
        contact = contactsByPhone.get(normalizedPhone);
        if (!contact) {
          const last10 = normalizedPhone.slice(-10);
          for (const [phone, c] of contactsByPhone.entries()) {
            if (phone.endsWith(last10) || last10.endsWith(phone.slice(-10))) {
              contact = c;
              break;
            }
          }
        }
      }

      if (contact) {
        return {
          id: conv.id,
          type: 'contact' as const,
          displayName: contact.alias || `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() || contact.phone,
          phone: contact.phone,
          otherUserId: conv.otherUserId,
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          contactId: contact.id,
          alias: contact.alias,
          customFirstName: contact.customFirstName,
          customLastName: contact.customLastName,
          avatarUrl: normalizeUrl(conv.otherUserAvatar),
        };
      } else {
        return {
          id: conv.id,
          type: 'unknown' as const,
          displayName: conv.otherUserName || conv.otherUserPhone || 'Usuario desconocido',
          phone: conv.otherUserPhone || '',
          otherUserId: conv.otherUserId,
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          avatarUrl: normalizeUrl(conv.otherUserAvatar),
        };
      }
    });

    const addedContactUserIds = new Set<string>();
    contacts.forEach(contact => {
      if (!conversationsByUserId.has(contact.contactUserId) && contact.contactUserId && !addedContactUserIds.has(contact.contactUserId)) {
        addedContactUserIds.add(contact.contactUserId);
        items.push({
          id: `contact-${contact.id}`,
          type: 'contact' as const,
          displayName: contact.alias || `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() || contact.phone,
          phone: contact.phone,
          otherUserId: contact.contactUserId,
          conversationId: undefined,
          unreadCount: 0,
          lastMessage: undefined,
          lastMessageTime: undefined,
          contactId: contact.id,
          alias: contact.alias,
          customFirstName: contact.customFirstName,
          customLastName: contact.customLastName,
        });
      }
    });

    return items;
  }, []);

  const loadFromLocalCache = useCallback(() => {
    if (!userId) return false;
    try {
      const localConvs = getLocalConversations();
      const localContacts = getLocalContacts(userId);

      if (localConvs.length > 0 || localContacts.length > 0) {
        const contacts: Contact[] = localContacts.map(c => ({
          id: c.id,
          ownerId: c.owner_id,
          contactUserId: c.contact_user_id,
          phone: c.phone,
          alias: c.alias || undefined,
          customFirstName: c.custom_first_name || undefined,
          customLastName: c.custom_last_name || undefined,
          createdAt: c.updated_at || new Date().toISOString(),
        }));

        const conversations = localConvs.map(c => ({
          id: c.id,
          otherUserId: c.other_user_id || '',
          otherUserName: c.other_user_name,
          otherUserPhone: c.other_user_phone,
          lastMessage: c.last_message,
          lastMessageAt: c.last_message_at,
          unreadCount: c.unread_count,
          otherUserAvatar: c.other_user_avatar,
          type: c.type as 'direct' | 'group' || 'direct',
          title: c.title || undefined,
          imageUrl: c.image_url || undefined,
          description: c.description || undefined,
          isGroup: c.type === 'group',
          participants: [], // Cache doesn't currently store participants separately
        }));

        const items = transformToItems(contacts, conversations);
        setChatItems(items);
        return true;
      }
    } catch (err) {
      console.error('Error loading from cache:', err);
    }
    return false;
  }, [userId, transformToItems]);

  const syncFromServer = useCallback(async (showLoading = false, force = false) => {
    if (!userId) return;
    if (!force && !shouldSync(`chats-${userId}`, 30000)) return;

    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const CONTACTS_SYNC_KEY = `tincadia_contacts_last_sync_${userId}`;
      const lastContactSync = force ? null : await AsyncStorage.getItem(CONTACTS_SYNC_KEY);

      const [contactsResponse, conversationsResponse] = await Promise.all([
        contactService.getContacts(userId, lastContactSync || undefined),
        chatService.getConversations(userId),
      ]);

      const contacts = contactsResponse.contacts || [];
      const conversations = conversationsResponse.conversations || [];

      contacts.forEach(c => {
        const ownerId = c.ownerId || userId;
        if (ownerId && c.id && c.contactUserId) {
          saveContact({
            id: c.id,
            ownerId,
            contactUserId: c.contactUserId,
            phone: c.phone || '',
            alias: c.alias,
            customFirstName: c.customFirstName,
            customLastName: c.customLastName,
          });
        }
      });

      if (contacts.length > 0) {
        await AsyncStorage.setItem(CONTACTS_SYNC_KEY, new Date().toISOString());
      }

      const fullContacts = getLocalContacts(userId).map(c => ({
        id: c.id,
        ownerId: c.owner_id,
        contactUserId: c.contact_user_id,
        phone: c.phone,
        alias: c.alias || undefined,
        customFirstName: c.custom_first_name || undefined,
        customLastName: c.custom_last_name || undefined,
        createdAt: c.updated_at || new Date().toISOString(),
      }));

      conversations.forEach(conv => {
        const existing = getConversation(conv.id);
        const isGroup = conv.isGroup || conv.type === 'group';
        const serverDescription = conv.description;
        const mergedDescription = serverDescription !== undefined && serverDescription !== null
          ? serverDescription
          : (isGroup ? (existing?.description || '') : (conv.description || ''));

        saveConversation({
          id: conv.id,
          otherUserId: conv.otherUserId,
          otherUserPhone: conv.otherUserPhone,
          otherUserName: conv.otherUserName,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
          otherUserAvatar: conv.otherUserAvatar,
          type: conv.type,
          title: conv.title ?? existing?.title ?? undefined,
          imageUrl: conv.imageUrl ?? existing?.image_url ?? undefined,
          description: mergedDescription,
        });
      });

      // Remove local conversations that no longer exist on the server
      const serverConvIds = new Set(conversations.map(c => c.id));
      const localConvs = getLocalConversations();
      localConvs.forEach(local => {
        if (!serverConvIds.has(local.id)) {
          localDeleteConversation(local.id);
        }
      });

      updateSyncTime(`chats-${userId}`);
      const items = transformToItems(fullContacts, conversations);
      setChatItems(items);
      
      // Also refresh notification count
      loadUnreadCount();
    } catch (err) {
      console.error('Error syncing chats:', err);
      if (showLoading) setError('Error al cargar chats');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [userId, transformToItems]);

  const loadChats = useCallback(async () => {
    if (!userId) return;
    const hasCached = loadFromLocalCache();
    if (hasCached) {
      setIsLoading(false);
      syncFromServer(false, true);
    } else {
      setIsLoading(true);
      await syncFromServer(true, true);
    }
  }, [userId, loadFromLocalCache, syncFromServer]);

  // Initial load and polling fallback
  useEffect(() => {
    loadChats();
    const interval = setInterval(() => {
      syncFromServer(false);
    }, 60000); // 60s polling safety net
    return () => clearInterval(interval);
  }, [loadChats, syncFromServer]);

  // Notification count
  const loadUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const { count } = await appNotificationService.getUnreadCount(userId);
      setUnreadNotificationCount(count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  }, [userId]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  // Listen for notifications_read event to reset count
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('notifications_read', () => {
      setUnreadNotificationCount(0);
    });

    // Listen for database updates
    const contactsSub = DeviceEventEmitter.addListener('contacts_updated', () => {
      console.log('🔄 Reactive refresh: contacts_updated');
      loadFromLocalCache();
    });
    
    const convsSub = DeviceEventEmitter.addListener('conversations_updated', () => {
      console.log('🔄 Reactive refresh: conversations_updated');
      loadFromLocalCache();
    });

    const chatLocalSub = DeviceEventEmitter.addListener('chat_local_update', () => {
      loadFromLocalCache();
    });

    const chatSyncSub = DeviceEventEmitter.addListener('chat_sync_requested', () => {
      console.log('🔄 Reactive refresh: chat_sync_requested (forcing sync)');
      syncFromServer(false, true);
    });

    return () => {
      subscription.remove();
      contactsSub.remove();
      convsSub.remove();
      chatLocalSub.remove();
      chatSyncSub.remove();
    };
  }, [loadFromLocalCache, syncFromServer]);

  // Clean up legacy synced contacts from AsyncStorage (one-time migration)
  useEffect(() => {
    AsyncStorage.removeItem(SYNCED_CONTACTS_KEY).catch(() => {});
  }, [SYNCED_CONTACTS_KEY]);

  // Foreground sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromServer(false, true); // Force sync when coming to foreground
      }
    });
    return () => subscription.remove();
  }, [syncFromServer]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!userId) return;

    const getMessagePreview = (type: string): string => {
      switch (type) {
        case 'image': return 'Foto';
        case 'audio': return 'Audio';
        case 'video': return 'Video';
        case 'call': return 'Llamada';
        case 'call_ended': return 'Llamada finalizada';
        case 'call_rejected': return 'Llamada rechazada';
        case 'call_missed': return 'Llamada perdida';
        default: return 'Nuevo mensaje...';
      }
    };



    const userChannel = supabase.channel(`user:${userId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const sm = payload.payload as { id?: string; conversationId: string; content: string; createdAt: string; senderId?: string; sender_id?: string; type?: string };
        if (sm) {
          const msgId = sm.id;
          const msgSenderId = sm.senderId ?? sm.sender_id;
          const isMine = isSameUserId(msgSenderId, userId);

          // Deduplication
          if (msgId && recentMessageIdsRef.current.has(msgId)) {
              return;
          }
          if (msgId) {
              recentMessageIdsRef.current.add(msgId);
              setTimeout(() => recentMessageIdsRef.current.delete(msgId), 10000);
          }

          if (!isMine) {
              const previewContent = getMessagePreview(sm.type || 'text');
              const updated = updateConversationPreview(sm.conversationId, previewContent, sm.createdAt, true);
              if (updated) {
                loadFromLocalCache();
              } else {
                syncFromServer(false);
              }
          }
        }
      })
      .on('broadcast', { event: 'conversation_deleted' }, (payload) => {
        const deleted = payload.payload as { id?: string };
        if (deleted?.id) {
          console.log('🗑️ Conversation deleted via broadcast:', deleted.id);
          localDeleteConversation(deleted.id);
          loadFromLocalCache();
        }
      })
      .on('broadcast', { event: 'message_updated' }, () => {
        // Reload local cache to pick up read receipts / status changes
        loadFromLocalCache();
      })
      .on('broadcast', { event: 'group_updated' }, (payload) => {
        const update = payload.payload as {
          conversationId?: string;
          title?: string;
          description?: string;
          imageUrl?: string;
        };

        if (!update?.conversationId) return;

        patchConversationMetadata({
          conversationId: update.conversationId,
          title: update.title,
          description: update.description,
          imageUrl: update.imageUrl,
        });
        loadFromLocalCache();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && wasDisconnectedRef.current) {
            console.log('🔄 Reconnected! Syncing missed conversations...');
            syncFromServer(false);
            wasDisconnectedRef.current = false;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            wasDisconnectedRef.current = true;
        }
      });

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [userId, loadFromLocalCache, syncFromServer]);

  // Filtered and Sorted list
  const filteredItems = useMemo(() => {
    const existingUserIds = new Set(chatItems.map(c => c.otherUserId).filter(Boolean));
    const uniqueSynced = syncedContacts.filter(s => !existingUserIds.has(s.otherUserId));
    let result = [...chatItems, ...uniqueSynced];

    // Final dedup safety net: one entry per otherUserId (prefer items with conversationId)
    const seen = new Map<string, ChatListItem>();
    const deduped: ChatListItem[] = [];
    for (const item of result) {
      if (!item.otherUserId || item.type === 'group') {
        deduped.push(item);
        continue;
      }
      const prev = seen.get(item.otherUserId);
      if (!prev) {
        seen.set(item.otherUserId, item);
        deduped.push(item);
      } else if (!prev.conversationId && item.conversationId) {
        const idx = deduped.indexOf(prev);
        if (idx !== -1) deduped[idx] = item;
        seen.set(item.otherUserId, item);
      }
    }
    result = deduped;

    if (activeFilter === 'groups') {
      result = result.filter(item => item.type === 'group');
    } else if (activeFilter === 'contacts') {
      result = result.filter(item => item.type !== 'group');
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        item.displayName?.toLowerCase().includes(query) || 
        item.phone?.includes(query)
      );
    }

    return result.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });
  }, [chatItems, syncedContacts, searchQuery, activeFilter]);

  const handleSyncContacts = async () => {
    const results = await startSync();
    
    // Recovery names from local address book to show names instead of numbers
    // Build phone → name map with multiple normalized formats for robust matching
    const contactMap = new Map<string, string>();
    try {
      const deviceContacts = await deviceContactsService.getContacts();
      deviceContacts.forEach(dc => {
        dc.phoneNumbers.forEach(p => {
          contactMap.set(p, dc.name);
          const digits = p.replace(/\D/g, '');
          contactMap.set(digits, dc.name);
          if (digits.length >= 10) {
            contactMap.set(digits.slice(-10), dc.name);
          }
        });
      });
    } catch (e) {
      console.warn('Could not load device contacts for name recovery:', e);
    }

    const resolveName = (phone: string): string | undefined => {
      const direct = contactMap.get(phone);
      if (direct) return direct;
      const digits = phone.replace(/\D/g, '');
      return contactMap.get(digits) || (digits.length >= 10 ? contactMap.get(digits.slice(-10)) : undefined);
    };

    const rawMatches = results.filter(m => m.isOnTincadia && m.userId && m.userId !== userId);
    const uniqueMatchesMap = new Map();
    rawMatches.forEach(m => {
      if (!uniqueMatchesMap.has(m.userId)) uniqueMatchesMap.set(m.userId, m);
    });
    const foundContacts = Array.from(uniqueMatchesMap.values());

    Alert.alert('Sincronización Completada', `Se encontraron ${foundContacts.length} contactos en Tincadia.`);
    
    setSyncResult({ found: foundContacts.length, total: results.length });
    setShowSyncBanner(false);

    const syncedItems: ChatListItem[] = foundContacts.map(match => {
      const recoveredName = resolveName(match.contact);
      
      return {
        id: `synced-${match.userId}`,
        type: 'synced' as const,
        displayName: recoveredName || match.contact,
        phone: match.contact,
        otherUserId: match.userId!,
        unreadCount: 0,
      };
    });

    setSyncedContacts(syncedItems);
    loadChats();
  };

  const deleteChat = (conversationId: string) => {
    if (localDeleteConversation(conversationId)) {
      loadFromLocalCache();
      return true;
    }
    return false;
  };

  /**
   * Remove a user from the in-memory synced contacts list.
   * Called when a contact is added or permanently deleted.
   */
  const removeFromSyncedCache = useCallback((otherUserId: string) => {
    setSyncedContacts(prev => prev.filter(s => s.otherUserId !== otherUserId));
  }, []);

  return {
    chatItems,
    filteredItems,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    isLoading,
    error,
    unreadNotificationCount,
    showSyncBanner,
    setShowSyncBanner,
    syncResult,
    isSyncing,
    progress,
    syncError,
    handleSyncContacts,
    loadChats,
    syncFromServer,
    loadFromLocalCache,
    deleteChat,
    removeFromSyncedCache,
    syncedContacts,
    setSyncedContacts,
  };
};
