/**
 * Chats Screen
 * 
 * Modern chat list design with search and floating new chat button.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  Platform,
  AppState,
  Image,
  Alert,
} from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { chatsListStyles } from '../styles/ChatsScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { useContactsSync } from '../hooks/useContactsSync';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { appNotificationService } from '../services/appNotification.service';
import {
  initChatDatabase,
  getConversations as getLocalConversations,
  saveConversation,
  getLocalContacts,
  saveContact,
  shouldSync,
  updateSyncTime,
  updateConversationPreview,
} from '../database/chatDatabase';
import { BottomNavigation } from './BottomNavigation';
import { ChatView } from './chat/ChatView';
import { NotificationsScreen } from './NotificationsScreen';
import {
  NotificationIcon,
  SearchIcon,
  PlusIcon,
  InviteIcon,
  AccountIcon,
} from './icons/NavigationIcons';
import { AddContactModal } from './AddContactModal';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call' | 'new_group', params?: { roomName?: string; username?: string; conversationId?: string; userId?: string }) => void;
  initialConversation?: { conversationId?: string; recipientId?: string; isGroup?: boolean; title?: string } | null;
  onInitialConversationOpened?: () => void;
}

// Format message time for display
const formatMessageTime = (dateString: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('es', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
    }
  } catch {
    return '';
  }
};

// Unified chat list item - can be contact, unknown conversation, or synced contact
interface ChatListItem {
  id: string;
  type: 'contact' | 'unknown' | 'synced' | 'group';
  displayName: string;
  phone: string;
  otherUserId: string;
  conversationId?: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
  // From contact
  contactId?: string;
  alias?: string;
  customFirstName?: string;
  customLastName?: string;
  avatarUrl?: string;
}

// Contact List Item Component
function ContactListItem({
  contact,
  onPress,
}: {
  contact: Contact;
  onPress: () => void;
}) {
  // Use alias if available, otherwise use custom names or fallback
  const displayName = contact.alias ||
    `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
    contact.phone;

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <TouchableOpacity style={styles.chatItem} onPress={onPress}>
      {/* Avatar with initials */}
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      {/* Contact Info */}
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{displayName}</Text>
          <Text style={styles.timestamp}>Contacto</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {contact.phone}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Main Chats Screen
export function ChatsScreen({ onNavigate, initialConversation, onInitialConversationOpened }: ChatsScreenProps) {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [chatItems, setChatItems] = useState<ChatListItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ChatListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChat, setSelectedChat] = useState<{
    conversationId: string;
    otherUserName: string;
    otherUserPhone?: string;
    otherUserId?: string;
    isUnknown?: boolean;
    // Contact info for profile
    contactId?: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
    avatarUrl?: string;
    isGroup?: boolean;
  } | null>(null);

  // Modal state
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState('');
  const [prefillFirstName, setPrefillFirstName] = useState('');
  const [prefillLastName, setPrefillLastName] = useState('');
  const [showFabMenu, setShowFabMenu] = useState(false);

  // Contacts sync
  const { isSyncing, progress, matches, error: syncError, startSync } = useContactsSync();
  const [showSyncBanner, setShowSyncBanner] = useState(true);
  const [syncResult, setSyncResult] = useState<{ found: number; total: number } | null>(null);
  const [syncedContacts, setSyncedContacts] = useState<ChatListItem[]>([]);

  // Notifications state
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const SYNCED_CONTACTS_KEY = `@synced_contacts_${userId}`;

  // Initialize database on mount
  useEffect(() => {
    initChatDatabase();
  }, []);

  // Load unread notification count
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
  }, [userId, showNotifications]); // Reload when returning from notifications

  // Load synced contacts from storage on mount
  useEffect(() => {
    const loadSyncedContacts = async () => {
      if (!userId) return;
      try {
        const stored = await AsyncStorage.getItem(SYNCED_CONTACTS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSyncedContacts(parsed);
          setShowSyncBanner(false);
          console.log('📱 Loaded synced contacts from storage:', parsed.length);
        }
      } catch (err) {
        console.error('Error loading synced contacts:', err);
      }
    };
    loadSyncedContacts();
  }, [userId, SYNCED_CONTACTS_KEY]);

  // Helper to transform local/server data to ChatListItem[]
  const transformToItems = useCallback((
    contacts: Contact[],
    conversations: { id: string; otherUserId: string; otherUserPhone?: string; lastMessage?: string; lastMessageAt?: string; unreadCount?: number; otherUserAvatar?: string; isGroup?: boolean; title?: string; imageUrl?: string }[]
  ): ChatListItem[] => {
    const contactsByUserId = new Map(contacts.map(c => [c.contactUserId, c]));
    const conversationsByUserId = new Map(conversations.map(conv => [conv.otherUserId, conv]));

    // Conversations with contact info
    const items: ChatListItem[] = conversations.map(conv => {
      // Handle Group
      if (conv.isGroup) {
        return {
          id: conv.id,
          type: 'group' as const,
          displayName: conv.title || 'Grupo',
          phone: '',
          otherUserId: '', // No one specific user
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          avatarUrl: conv.imageUrl || conv.otherUserAvatar, // Use imageUrl preferably for groups
        };
      }

      const contact = contactsByUserId.get(conv.otherUserId);
      if (contact) {
        return {
          id: conv.id,
          type: 'contact' as const,
          displayName: contact.alias ||
            `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
            contact.phone,
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
          avatarUrl: conv.otherUserAvatar, // Map from backend response
        };
      } else {
        return {
          id: conv.id,
          type: 'unknown' as const,
          displayName: conv.otherUserPhone || 'Usuario desconocido',
          phone: conv.otherUserPhone || '',
          otherUserId: conv.otherUserId,
          conversationId: conv.id,
          unreadCount: conv.unreadCount || 0,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageAt,
          avatarUrl: conv.otherUserAvatar, // Map from backend response
        };
      }
    });

    // Contacts without conversations
    contacts.forEach(contact => {
      if (!conversationsByUserId.has(contact.contactUserId) && contact.contactUserId) {
        items.push({
          id: `contact-${contact.id}`,
          type: 'contact' as const,
          displayName: contact.alias ||
            `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
            contact.phone,
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

  // Load from local cache (instant)
  const loadFromLocalCache = useCallback(() => {
    if (!userId) return;

    try {
      // Get cached conversations
      const localConvs = getLocalConversations();
      const localContacts = getLocalContacts(userId);

      if (localConvs.length > 0 || localContacts.length > 0) {
        // Transform local data
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
          otherUserId: c.other_user_id,
          otherUserPhone: c.other_user_phone,
          lastMessage: c.last_message,
          lastMessageAt: c.last_message_at,
          unreadCount: c.unread_count, // Use stored server count
          otherUserAvatar: c.other_user_avatar, // Map from local DB
        }));

        const items = transformToItems(contacts, conversations);
        setChatItems(items);
        console.log('⚡ Loaded from cache:', items.length, 'items');
        return true;
      }
    } catch (err) {
      console.error('Error loading from cache:', err);
    }
    return false;
  }, [userId, transformToItems]);

  // Sync from server and update cache
  const syncFromServer = useCallback(async (showLoading = false, force = false) => {
    if (!userId) return;

    // Skip if synced recently (< 30 seconds) unless forced
    if (!force && !shouldSync(`chats-${userId}`, 30000)) {
      console.log('⏭️ Skipping sync (too recent)');
      if (showLoading) setIsLoading(false);
      return;
    }

    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Syncing from server...');
      const [contactsResponse, conversationsResponse] = await Promise.all([
        contactService.getContacts(userId),
        chatService.getConversations(userId),
      ]);

      const contacts = contactsResponse.contacts || [];
      const conversations = conversationsResponse.conversations || [];

      // Save to local cache for future instant loads
      contacts.forEach(c => {
        // Only save if we have valid ownerId (use userId as fallback)
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

      conversations.forEach(conv => saveConversation({
        id: conv.id,
        otherUserId: conv.otherUserId,
        otherUserPhone: conv.otherUserPhone,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount,
        otherUserAvatar: conv.otherUserAvatar, // Save avatar to DB
      }));

      updateSyncTime(`chats-${userId}`);

      // Update UI with fresh data
      // Use server provided unreadCount for the list view as it is the source of truth
      // Local calculation (getUnreadCountForConversation) only works if messages are synced locally
      const items = transformToItems(contacts, conversations);
      setChatItems(items);
      console.log('✅ Synced:', items.length, 'items');
    } catch (err) {
      console.error('Error syncing chats:', err);
      if (showLoading) setError('Error al cargar chats');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [userId, transformToItems]);

  // Main load function: local-first, then ALWAYS sync from server on mount
  const loadChats = useCallback(async () => {
    if (!userId) return;

    // 1. Load from cache instantly (no loading spinner) for immediate UI
    const hasCached = loadFromLocalCache();

    if (hasCached) {
      // 2. Sync from server in background (FORCE to ensure fresh data after login)
      setIsLoading(false);
      syncFromServer(false, true); // force=true to bypass throttle
    } else {
      // 3. No cache - show loading and fetch from server
      setIsLoading(true);
      await syncFromServer(true, true); // showLoading=true, force=true
    }
  }, [userId, loadFromLocalCache, syncFromServer]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Handle initial conversation (deep link)
  useEffect(() => {
    if (initialConversation && userId) {
      console.log('🚀 Opening initial conversation:', initialConversation);
      const openInitialChat = async () => {
        try {
          // Case 1: Direct open (Group)
          if (initialConversation.conversationId && initialConversation.isGroup) {
            setSelectedChat({
              conversationId: initialConversation.conversationId,
              otherUserName: initialConversation.title || 'Grupo',
              otherUserPhone: '',
              otherUserId: '',
              isUnknown: false,
              isGroup: true
            });
            if (onInitialConversationOpened) onInitialConversationOpened();
            return;
          }

          // Case 2: User/Contact
          const recipientId = initialConversation.recipientId;
          let conversationId = initialConversation.conversationId;

          if (!conversationId && recipientId) {
            const response = await chatService.startConversation(userId, recipientId);
            conversationId = response.conversationId;
          }

          if (!conversationId || !recipientId) return;

          // For now, we try to startConversation to ensure it exists and get fresh conversationId
          // This is safe (idempotent)
          // const response = await chatService.startConversation(userId, initialConversation.recipientId);

          // We need the other user's name/phone to display nicely
          // We can fetch from contactsService or Profiles
          // Quick implementation: Fetch profile of other user
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone')
            .eq('id', recipientId)
            .single() as { data: any, error: any };

          const displayName = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : profile?.phone || 'Usuario';

          setSelectedChat({
            conversationId: conversationId,
            otherUserName: displayName,
            otherUserPhone: profile?.phone || '',
            otherUserId: recipientId,
            isUnknown: false, // Assume false for now or logic to check contact
            isGroup: false
          });

          if (onInitialConversationOpened) {
            onInitialConversationOpened();
          }
        } catch (e) {
          console.error('Error opening initial conversation:', e);
        }
      };
      openInitialChat();
    }
  }, [initialConversation, userId]);

  // Sync when app comes to foreground (smart refresh)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('📱 App came to foreground, syncing...');
        syncFromServer(false);
      }
    });

    return () => subscription.remove();
  }, [syncFromServer]);

  // Subscribe to real-time message updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as any;

          // For INSERT: Refresh list for new messages
          if (payload.eventType === 'INSERT') {
            console.log('📩 New message received, refreshing chat list');

            const newMsg = payload.new as any;
            const conversationId = newMsg.conversation_id;
            const isMine = newMsg.sender_id === userId;
            const isCurrentChat = selectedChat?.conversationId === conversationId;

            // ✅ OPTIMIZATION: Update local database immediately
            if (conversationId) {
              let previewContent = newMsg.content;

              if (!isMine) {
                // Incoming: Encrypted payload -> Placeholder until sync
                if (newMsg.type === 'text') {
                  previewContent = 'Nuevo mensaje...';
                } else if (newMsg.type === 'image') {
                  previewContent = '📷 Foto';
                } else if (newMsg.type === 'audio') {
                  previewContent = '🎤 Audio';
                }
              } else {
                // Outgoing (Mine): We likely have the REAL content in local DB from optimistic update
                // But we need to fetch it to be sure, or trust that sendMessage updated 'messages' table
                // We can't query SQLite synchronously easily inside this callback without imports or checks
                // But 'loadFromLocalCache' below will reload the LIST from 'conversations'.
                // We need to update 'conversations' table.

                // If we simply use newMsg.content (encrypted), we break the UI.
                // Ideally we shouldn't touch the preview for OWN messages here if we can't decrypt
                // UNLESS we know what we sent.

                // However, syncFromServer(true) will fix it. 
                // To avoid "Nuevo mensaje..." flash, we SKIP updating preview content for isMine 
                // and ONLY update the timestamp/order, OR we assume the list is already optimistic from sendMessage?
                // Actually sendMessage OPTIMISTICALLY updates 'messages' but NOT 'conversations'.
                // So we DO need to update 'conversations'.

                // Let's try to pass the encrypted content? No.
                // Let's set a generic "Tú: Mensaje" placeholder? No.

                // Best bet: Don't overwrite content if isMine, just timestamp.
                // But then the list order might update but empty preview? 
                // Actually, let's trigger sync and rely on that for isMine content
                // OR use 'Tu envió un mensaje'

                // Better: Attempt to get content from local 'messages' table if possible?
                // Easier: Check if we have the message in cache?
                // Let's just use "..." for isMine if we can't get text, which is better than encrypted.
                // But users hate "...".

                // Allow sync to handle isMine content update, but force the timestamp update so it jumps to top.
                // AND mark as unread? No, isMine doesn't increment unread.
              }

              // Update conversation metadata (moves to top)
              // Only update content if !isMine (placeholder)
              if (!isMine) {
                updateConversationPreview(
                  conversationId,
                  previewContent,
                  newMsg.created_at,
                  !isCurrentChat // Increment unread
                );
              } else {
                // For isMine, we just update timestamp to bump it?
                // But we need to update 'last_message' too or it looks stale.
                // We will skip local preview update for isMine and rely on sync, 
                // BUT we must ensure sync happens fast.
                // Actually, let's invoke syncFromServer immediately.
              }

              // Reload list from cache to show update instantly
              loadFromLocalCache();
            }

            // Always force sync to get decrypted content for both sides
            syncFromServer(false, true);
          }

          // For UPDATE: Refresh if status changed (e.g. read) to update badges
          else if (payload.eventType === 'UPDATE') {
            console.log('� Message updated, syncing...');
            syncFromServer(false, true);
          }
        }
      )
      .subscribe((status) => {
        console.log('� Chat list realtime subscription:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from chat list updates');
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // EXPERIMENTAL: Subscribe to User Channel for DIRECT Broadcasts (Bypassing Postgres Lag)
  useEffect(() => {
    if (!userId) return;

    const userChannel = supabase.channel(`user:${userId}`)
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.log('🚀 [Direct] New message broadcast received:', payload);
        const newMsg = payload.payload;
        if (newMsg) {
          // Update preview instantly!
          updateConversationPreview(
            newMsg.conversationId,
            newMsg.content, // Using decrypted/clean content from broadcast
            newMsg.createdAt,
            true // Increment unread
          );
          loadFromLocalCache();

          // Still sync in background to be safe
          syncFromServer(false, true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [userId]);


  // Combine chat items with synced contacts (excluding duplicates)
  const allItems = useMemo(() => {
    const existingUserIds = new Set(chatItems.map(c => c.otherUserId));
    const uniqueSynced = syncedContacts.filter(s => !existingUserIds.has(s.otherUserId));
    return [...chatItems, ...uniqueSynced];
  }, [chatItems, syncedContacts]);

  // Update filtered items when allItems changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(allItems);
    }
  }, [allItems, searchQuery]);

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredItems(allItems);
      return;
    }
    const filtered = allItems.filter(
      (item) =>
        item.displayName?.toLowerCase().includes(text.toLowerCase()) ||
        item.phone?.includes(text)
    );
    setFilteredItems(filtered);
  };

  // Handle chat item tap - start or get conversation
  const handleItemPress = async (item: ChatListItem) => {
    try {
      let conversationId: string;

      if (item.conversationId) {
        // Already has conversation
        conversationId = item.conversationId;
      } else {
        // Need to start/get conversation (synced contact or contact without chat)
        console.log('🚀 Starting conversation with:', item.otherUserId);
        const response = await chatService.startConversation(userId, item.otherUserId);
        conversationId = response.conversationId;
        console.log('✅ Got conversationId:', conversationId);
      }

      setSelectedChat({
        conversationId,
        otherUserName: item.displayName,
        otherUserPhone: item.phone,
        otherUserId: item.otherUserId,
        isUnknown: item.type === 'unknown',
        isGroup: item.type === 'group',
        contactId: item.contactId,
        alias: item.alias,
        customFirstName: item.customFirstName,
        customLastName: item.customLastName,
        avatarUrl: item.avatarUrl,
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Error al iniciar conversación');
    }
  };

  // Handle contact deletion
  const handleDeleteContact = (item: ChatListItem) => {
    if (item.type !== 'contact' || !item.contactId) return;

    Alert.alert(
      'Eliminar contacto',
      `¿Estás seguro de que quieres eliminar a ${item.displayName}? Se borrarán todas las conversaciones y mensajes asociados.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              if (item.contactId) {
                await contactService.deleteContact(item.contactId);
              }
              // Refresh list
              loadChats();
            } catch (error) {
              console.error('Error deleting contact:', error);
              Alert.alert('Error', 'No se pudo eliminar el contacto');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Handle back from chat - load cache immediately, sync later
  const handleBack = useCallback(() => {
    setSelectedChat(null);
    // Force immediate refresh bypassing throttle
    console.log('🔄 Closing chat, forcing immediate sync...');
    loadFromLocalCache(); // Show updated cache instantly
    syncFromServer(false, true); // Force sync (bypass 30s throttle)
  }, [loadFromLocalCache, syncFromServer]);

  // Android hardware back: if inside a chat, go back to chat list instead of exiting the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!selectedChat) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });

    return () => sub.remove();
  }, [selectedChat, handleBack]);

  // Handle adding unknown contact
  const handleAddUnknownContact = () => {
    if (selectedChat?.otherUserPhone) {
      setPrefillPhone(selectedChat.otherUserPhone);
      setShowAddContactModal(true);
    }
  };

  // Handle contacts sync
  const handleSyncContacts = async () => {
    setSyncResult(null);
    setSyncedContacts([]);
    const results = await startSync();
    // Filter: must be on Tincadia, have userId, and NOT be the current user
    const foundContacts = results.filter(m => m.isOnTincadia && m.userId && m.userId !== userId);
    setSyncResult({ found: foundContacts.length, total: results.length });
    setShowSyncBanner(false);

    // Convert matches to ChatListItems
    const syncedItems: ChatListItem[] = foundContacts.map((match, index) => ({
      id: `synced-${match.userId}-${index}`,
      type: 'synced' as const,
      displayName: match.contact, // Phone number for now
      phone: match.contact,
      otherUserId: match.userId!,
      unreadCount: 0,
    }));

    console.log('📱 Synced contacts (excluding self):', syncedItems.length);
    setSyncedContacts(syncedItems);

    // Save to AsyncStorage for persistence
    try {
      await AsyncStorage.setItem(SYNCED_CONTACTS_KEY, JSON.stringify(syncedItems));
      console.log('📱 Saved synced contacts to storage');
    } catch (err) {
      console.error('Error saving synced contacts:', err);
    }

    loadChats();
  };

  // Show individual chat if selected
  if (selectedChat) {
    const keyboardOffset = Platform.OS === 'ios' ? 100 : 0;

    return (
      <KeyboardSafeView style={styles.container} offset={keyboardOffset} dismissOnPress={false}>
        <StatusBar style="dark" />
        <ChatView
          conversationId={selectedChat.conversationId}
          otherUserName={selectedChat.otherUserName}
          otherUserPhone={selectedChat.otherUserPhone}
          otherUserId={selectedChat.otherUserId}
          otherUserAvatar={selectedChat.avatarUrl}
          isUnknown={selectedChat.isUnknown}
          isGroup={selectedChat.isGroup}
          userId={userId}
          currentUser={user}
          onBack={handleBack}
          onAddContact={handleAddUnknownContact}
          contactId={selectedChat.contactId}
          alias={selectedChat.alias}
          customFirstName={selectedChat.customFirstName}
          customLastName={selectedChat.customLastName}
          onContactUpdate={(contact) => {
            // Save contact to local cache immediately
            if (contact && userId) {
              saveContact({
                id: contact.id,
                ownerId: contact.ownerId || userId,
                contactUserId: contact.contactUserId,
                phone: contact.phone || '',
                alias: contact.alias,
                customFirstName: contact.customFirstName,
                customLastName: contact.customLastName,
              });
            }

            // Update selected chat immediately with new contact info
            const displayName = contact.alias ||
              `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
              contact.phone;

            setSelectedChat(prev => prev ? ({
              ...prev,
              otherUserName: displayName,
              isUnknown: false
            }) : null);

            // Force server sync (bypass throttle by updating sync time first)
            syncFromServer(false);
          }}
          onNavigateCall={(roomName, username, conversationId, passedUserId) => onNavigate('call', { roomName, username, conversationId, userId: passedUserId })}
        />
      </KeyboardSafeView>
    );
  }

  // Show notifications screen if selected
  if (showNotifications) {
    return (
      <NotificationsScreen
        userId={userId}
        onBack={() => setShowNotifications(false)}
      />
    );
  }

  // Show user list
  return (
    <KeyboardSafeView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => setShowNotifications(true)}
          >
            <NotificationIcon size={24} color="#333333" />
            {unreadNotificationCount > 0 && (
              <View style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 4,
              }}>
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>
                  {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color="#666666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar chats"
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#666666"
          />
        </View>
      </View>

      {/* Sync Contacts Banner */}
      {showSyncBanner && !isSyncing && !syncResult && (
        <TouchableOpacity style={styles.syncBanner} onPress={handleSyncContacts}>
          <View style={styles.syncBannerContent}>
            <Text style={styles.syncBannerIcon}>📱</Text>
            <View style={styles.syncBannerText}>
              <Text style={styles.syncBannerTitle}>Encontrar amigos en Tincadia</Text>
              <Text style={styles.syncBannerSubtitle}>Sincroniza tus contactos</Text>
            </View>
          </View>
          <Text style={styles.syncBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Syncing Progress */}
      {isSyncing && (
        <View style={styles.syncProgress}>
          <ActivityIndicator size="small" color="#7FA889" />
          <Text style={styles.syncProgressText}>
            Sincronizando... {progress?.percentage || 0}%
          </Text>
        </View>
      )}

      {/* Sync Result */}
      {syncResult && (
        <View style={styles.syncResult}>
          <Text style={styles.syncResultText}>
            ✓ {syncResult.found} contactos encontrados en Tincadia
          </Text>
        </View>
      )}

      {/* Sync Error */}
      {syncError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{syncError}</Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading && chatItems.length === 0 && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7FA889" />
          <Text style={styles.loadingText}>Cargando chats...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && filteredItems.length === 0 && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyStateText}>No tienes chats aún</Text>
          <Text style={styles.emptyStateSubtext}>Toca + para agregar un contacto</Text>
        </View>
      )}

      {/* Chats List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const initials = item.displayName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase() || '?';

          return (
            <View style={styles.chatItemRow}>
              <TouchableOpacity
                style={styles.chatItem}
                onPress={() => handleItemPress(item)}
                onLongPress={() => handleDeleteContact(item)}
                delayLongPress={500}
              >
                {/* Avatar with initials */}
                <View style={[
                  styles.avatarContainer,
                  item.type === 'unknown' && { backgroundColor: '#9CA3AF' },
                  item.type === 'synced' && { backgroundColor: '#3B82F6' },
                  // Remove background color if image exists so it doesn't bleed
                  item.avatarUrl ? { backgroundColor: 'transparent' } : {}
                ]}>
                  {item.avatarUrl ? (
                    <Image
                      source={{ uri: item.avatarUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <Text style={styles.avatarText}>{initials}</Text>
                  )}
                </View>

                {/* Chat Info */}
                <View style={styles.chatContent}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>{item.displayName}</Text>
                    <Text style={[styles.timestamp, item.type === 'synced' && { color: '#3B82F6' }]}>
                      {item.type === 'synced'
                        ? '✓ En Tincadia'
                        : item.lastMessageTime
                          ? formatMessageTime(item.lastMessageTime)
                          : item.type === 'unknown' ? 'Desconocido' : ''}
                    </Text>
                  </View>
                  <View style={styles.messageRow}>
                    <Text style={styles.lastMessage} numberOfLines={1}>
                      {item.lastMessage
                        ? (item.lastMessage.includes('📞') || item.lastMessage.includes('Llamada'))
                          ? <Text style={{ color: item.lastMessage.includes('finalizada') ? '#EF4444' : '#3B82F6', fontWeight: '500' }}>
                            {item.lastMessage.includes('finalizada') ? '☎️ Llamada finalizada' : '📞 Llamada entrante'}
                          </Text>
                          : ((item.lastMessage.startsWith('http') || item.lastMessage.startsWith('uploads/')) &&
                            (item.lastMessage.includes('/chat-media/') ||
                              item.lastMessage.match(/\.(jpg|jpeg|png|gif|webp)/i)))
                            ? '📷 Imagen'
                            : ((item.lastMessage.startsWith('http') || item.lastMessage.startsWith('uploads/')) &&
                              item.lastMessage.match(/\.(m4a|mp3|wav|ogg|aac)/i))
                              ? '🎵 Audio'
                              : item.lastMessage
                        : item.phone}
                    </Text>
                    {/* Unread count badge - green */}
                    {item.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Add contact button for synced contacts */}
              {item.type === 'synced' && (
                <TouchableOpacity
                  style={styles.addContactButton}
                  onPress={() => {
                    setPrefillPhone(item.phone);
                    // Try to split displayName into first and last name
                    const nameParts = (item.displayName || '').split(' ');
                    setPrefillFirstName(nameParts[0] || '');
                    setPrefillLastName(nameParts.slice(1).join(' ') || '');
                    setShowAddContactModal(true);
                  }}
                >
                  <PlusIcon size={20} color="#3B82F6" />
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadChats}
            colors={['#7FA889']}
            tintColor="#7FA889"
          />
        }
      />

      {/* FAB Menu Overlay */}
      {showFabMenu && (
        <TouchableOpacity
          style={styles.fabOverlay}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}

      {/* FAB Menu Items */}
      {showFabMenu && (
        <View style={styles.fabMenuContainer}>
          <View style={styles.fabMenuItem}>
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelText}>Nuevo grupo</Text>
            </View>
            <TouchableOpacity
              style={styles.fabMenuButton}
              onPress={() => {
                setShowFabMenu(false);
                onNavigate('new_group');
              }}
            >
              <InviteIcon size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={styles.fabMenuItem}>
            <View style={styles.fabMenuLabel}>
              <Text style={styles.fabMenuLabelText}>Nuevo contacto</Text>
            </View>
            <TouchableOpacity
              style={styles.fabMenuButton}
              onPress={() => {
                setShowFabMenu(false);
                setShowAddContactModal(true);
              }}
            >
              <AccountIcon size={24} color="#374151" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main FAB */}
      <TouchableOpacity
        style={styles.newChatButton}
        onPress={() => setShowFabMenu(!showFabMenu)}
        activeOpacity={0.8}
      >
        <View style={{ transform: [{ rotate: showFabMenu ? '45deg' : '0deg' }] }}>
          <PlusIcon size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Add Contact Modal */}
      <AddContactModal
        visible={showAddContactModal}
        onClose={() => {
          setShowAddContactModal(false);
          setPrefillPhone('');
          setPrefillFirstName('');
          setPrefillLastName('');
        }}
        onContactAdded={loadChats}
        userId={userId}
        initialPhone={prefillPhone}
        initialFirstName={prefillFirstName}
        initialLastName={prefillLastName}
      />

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </KeyboardSafeView>
  );
}

// Use styles from external file
const styles = chatsListStyles;
