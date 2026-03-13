import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { appNotificationService } from '../services/appNotification.service';
import { useContactsSync } from './useContactsSync';
import {
  getConversations as getLocalConversations,
  getLocalContacts,
  saveContact,
  saveConversation,
  shouldSync,
  updateSyncTime,
  updateConversationPreview,
  deleteConversation as localDeleteConversation,
} from '../database/chatDatabase';

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

  const SYNCED_CONTACTS_KEY = `@synced_contacts_${userId}`;

  // Transform helper
  const transformToItems = useCallback((
    contacts: Contact[],
    conversations: any[]
  ): ChatListItem[] => {
    const contactsByUserId = new Map(contacts.filter(c => c.contactUserId).map(c => [c.contactUserId, c]));
    const contactsByPhone = new Map(contacts.filter(c => c.phone).map(c => [c.phone.replace(/\D/g, ''), c]));
    const conversationsByUserId = new Map(conversations.map(conv => [conv.otherUserId, conv]));

    const items: ChatListItem[] = conversations.map(conv => {
      if (conv.isGroup) {
        return {
          id: conv.id,
          type: 'group' as const,
          displayName: conv.title || 'Grupo',
          phone: '',
          otherUserId: '',
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          avatarUrl: conv.imageUrl || conv.otherUserAvatar,
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
          avatarUrl: conv.otherUserAvatar,
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
          avatarUrl: conv.otherUserAvatar,
        };
      }
    });

    contacts.forEach(contact => {
      if (!conversationsByUserId.has(contact.contactUserId) && contact.contactUserId) {
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
          isGroup: c.type === 'group',
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
      const lastContactSync = await AsyncStorage.getItem(CONTACTS_SYNC_KEY);

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

      conversations.forEach(conv => saveConversation({
        id: conv.id,
        otherUserId: conv.otherUserId,
        otherUserPhone: conv.otherUserPhone,
        otherUserName: conv.otherUserName,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
        otherUserAvatar: conv.otherUserAvatar,
        type: conv.type,
        title: conv.title,
        imageUrl: conv.imageUrl,
      }));

      updateSyncTime(`chats-${userId}`);
      const items = transformToItems(fullContacts, conversations);
      setChatItems(items);
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

  // Initial load
  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Notification count
  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!userId) return;
      try {
        const { count } = await appNotificationService.getUnreadCount(userId);
        setUnreadNotificationCount(count);
      } catch (err) {
        console.error('Error loading unread count:', err);
      }
    };
    loadUnreadCount();
  }, [userId]);

  // Synced contacts from storage
  useEffect(() => {
    const loadSyncedContacts = async () => {
      if (!userId) return;
      try {
        const stored = await AsyncStorage.getItem(SYNCED_CONTACTS_KEY);
        if (stored) {
          setSyncedContacts(JSON.parse(stored));
          setShowSyncBanner(false);
        }
      } catch (err) {
        console.error('Error loading synced contacts:', err);
      }
    };
    loadSyncedContacts();
  }, [userId, SYNCED_CONTACTS_KEY]);

  // Foreground sync
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromServer(false);
      }
    });
    return () => subscription.remove();
  }, [syncFromServer]);

  // Real-time Subscriptions
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new as any;
          const isMine = newMsg.sender_id === userId;
          if (newMsg.conversation_id && !isMine) {
            let previewContent = 'Nuevo mensaje...';
            if (newMsg.type === 'image') previewContent = '📷 Foto';
            else if (newMsg.type === 'audio') previewContent = '🎤 Audio';
            
            updateConversationPreview(newMsg.conversation_id, previewContent, newMsg.created_at, true);
            loadFromLocalCache();
          }
          syncFromServer(false, true);
        } else if (payload.eventType === 'UPDATE') {
          syncFromServer(false, true);
        }
      })
      .subscribe();

    const userChannel = supabase.channel(`user:${userId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMsg = payload.payload;
        if (newMsg) {
          updateConversationPreview(newMsg.conversationId, newMsg.content, newMsg.createdAt, true);
          loadFromLocalCache();
          syncFromServer(false, true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(userChannel);
    };
  }, [userId, loadFromLocalCache, syncFromServer]);

  // Filtered and Sorted list
  const filteredItems = useMemo(() => {
    const existingUserIds = new Set(chatItems.map(c => c.otherUserId).filter(Boolean));
    const uniqueSynced = syncedContacts.filter(s => !existingUserIds.has(s.otherUserId));
    let result = [...chatItems, ...uniqueSynced];

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
    const rawMatches = results.filter(m => m.isOnTincadia && m.userId && m.userId !== userId);
    const uniqueMatchesMap = new Map();
    rawMatches.forEach(m => {
      if (!uniqueMatchesMap.has(m.userId)) uniqueMatchesMap.set(m.userId, m);
    });
    const foundContacts = Array.from(uniqueMatchesMap.values());

    Alert.alert('Sincronización Completada', `Se encontraron ${foundContacts.length} contactos en Tincadia.`);
    
    setSyncResult({ found: foundContacts.length, total: results.length });
    setShowSyncBanner(false);

    const syncedItems: ChatListItem[] = foundContacts.map(match => ({
      id: `synced-${match.userId}`,
      type: 'synced' as const,
      displayName: match.contact,
      phone: match.contact,
      otherUserId: match.userId!,
      unreadCount: 0,
    }));

    setSyncedContacts(syncedItems);
    await AsyncStorage.setItem(SYNCED_CONTACTS_KEY, JSON.stringify(syncedItems));
    loadChats();
  };

  const deleteChat = (conversationId: string) => {
    if (localDeleteConversation(conversationId)) {
      loadFromLocalCache();
      return true;
    }
    return false;
  };

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
    syncedContacts,
    setSyncedContacts,
    SYNCED_CONTACTS_KEY
  };
};
