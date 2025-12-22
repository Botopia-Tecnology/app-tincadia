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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { chatsListStyles } from '../styles/ChatsScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { useContactsSync } from '../hooks/useContactsSync';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import {
  initChatDatabase,
  getConversations as getLocalConversations,
  saveConversation,
  getLocalContacts,
  saveContact,
  shouldSync,
  updateSyncTime,
} from '../database/chatDatabase';
import { BottomNavigation } from './BottomNavigation';
import { ChatView } from './chat/ChatView';
import {
  NotificationIcon,
  SearchIcon,
  PlusIcon,
} from './icons/NavigationIcons';
import { AddContactModal } from './AddContactModal';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call', params?: { roomName?: string; username?: string; conversationId?: string; userId?: string }) => void;
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
  type: 'contact' | 'unknown' | 'synced';
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
export function ChatsScreen({ onNavigate }: ChatsScreenProps) {
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
  } | null>(null);

  // Modal state
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [prefillPhone, setPrefillPhone] = useState('');
  const [prefillFirstName, setPrefillFirstName] = useState('');
  const [prefillLastName, setPrefillLastName] = useState('');

  // Contacts sync
  const { isSyncing, progress, matches, error: syncError, startSync } = useContactsSync();
  const [showSyncBanner, setShowSyncBanner] = useState(true);
  const [syncResult, setSyncResult] = useState<{ found: number; total: number } | null>(null);
  const [syncedContacts, setSyncedContacts] = useState<ChatListItem[]>([]);

  const SYNCED_CONTACTS_KEY = `@synced_contacts_${userId}`;

  // Initialize database on mount
  useEffect(() => {
    initChatDatabase();
  }, []);

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
    conversations: { id: string; otherUserId: string; otherUserPhone?: string; lastMessage?: string; lastMessageAt?: string; unreadCount?: number }[]
  ): ChatListItem[] => {
    const contactsByUserId = new Map(contacts.map(c => [c.contactUserId, c]));
    const conversationsByUserId = new Map(conversations.map(conv => [conv.otherUserId, conv]));

    // Conversations with contact info
    const items: ChatListItem[] = conversations.map(conv => {
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
          unreadCount: c.unread_count,
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
  const syncFromServer = useCallback(async (showLoading = false) => {
    if (!userId) return;

    // Skip if synced recently (< 30 seconds) - rely on cache for instant load
    if (!shouldSync(`chats-${userId}`, 30000)) {
      console.log('⏭️ Skipping sync (too recent)');
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
      }));

      updateSyncTime(`chats-${userId}`);

      // Update UI with fresh data
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

  // Main load function: local-first, then background sync
  const loadChats = useCallback(async () => {
    if (!userId) return;

    // 1. Load from cache instantly (no loading spinner)
    const hasCached = loadFromLocalCache();

    if (hasCached) {
      // 2. Sync in background (no loading state)
      setIsLoading(false);
      syncFromServer(false);
    } else {
      // 3. No cache - show loading and fetch from server
      setIsLoading(true);
      await syncFromServer(true);
    }
  }, [userId, loadFromLocalCache, syncFromServer]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

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
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new as {
            conversation_id: string;
            sender_id: string;
          };

          // Only reload if message is for this user (not sent by them)
          // and user is not currently in that chat
          if (newMessage.sender_id !== userId && selectedChat?.conversationId !== newMessage.conversation_id) {
            console.log('📩 New message received, refreshing chat list');
            loadChats();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
      });

    return () => {
      console.log('🔌 Unsubscribing from realtime');
      supabase.removeChannel(channel);
    };
  }, [userId, selectedChat, loadChats]);

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
        contactId: item.contactId,
        alias: item.alias,
        customFirstName: item.customFirstName,
        customLastName: item.customLastName,
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Error al iniciar conversación');
    }
  };

  // Handle back from chat - load cache immediately, sync later
  const handleBack = useCallback(() => {
    setSelectedChat(null);
    // Load from cache immediately (synchronous)
    loadFromLocalCache();
    // Sync from server in background (don't wait)
    syncFromServer(false);
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
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ChatView
          conversationId={selectedChat.conversationId}
          otherUserName={selectedChat.otherUserName}
          otherUserPhone={selectedChat.otherUserPhone}
          otherUserId={selectedChat.otherUserId}
          isUnknown={selectedChat.isUnknown}
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
      </SafeAreaView>
    );
  }

  // Show user list
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity style={styles.notificationButton}>
            <NotificationIcon size={24} color="#333333" />
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
              <TouchableOpacity style={styles.chatItem} onPress={() => handleItemPress(item)}>
                {/* Avatar with initials */}
                <View style={[
                  styles.avatarContainer,
                  item.type === 'unknown' && { backgroundColor: '#9CA3AF' },
                  item.type === 'synced' && { backgroundColor: '#3B82F6' }
                ]}>
                  <Text style={styles.avatarText}>{initials}</Text>
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
                      {item.lastMessage || item.phone}
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

      {/* New Contact Floating Button */}
      <TouchableOpacity style={styles.newChatButton} onPress={() => setShowAddContactModal(true)}>
        <PlusIcon size={24} color="#FFFFFF" />
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
    </SafeAreaView>
  );
}

// Use styles from external file
const styles = chatsListStyles;
