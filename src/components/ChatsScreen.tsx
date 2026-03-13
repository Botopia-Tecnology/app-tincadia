/**
 * Chats Screen - Refactored
 * 
 * Uses modular components and useChatList hook for better maintainability.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { chatsListStyles } from '../styles/ChatsScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { chatService } from '../services/chat.service';
import { saveContact } from '../database/chatDatabase';
import { useChatList, ChatListItem as ChatListItemType } from '../hooks/useChatList';

// Components
import { BottomNavigation } from './BottomNavigation';
import { ChatView } from './chat/ChatView';
import { NotificationsScreen } from './NotificationsScreen';
import { AddContactModal } from './AddContactModal';
import { ChatListItem } from './chat/ChatListItem';
import { ChatsHeader } from './chat/ChatsHeader';
import { PlusIcon, InviteIcon, AccountIcon } from './icons/NavigationIcons';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call' | 'new_group', params?: { roomName?: string; username?: string; conversationId?: string; userId?: string }) => void;
  initialConversation?: { conversationId?: string; recipientId?: string; isGroup?: boolean; title?: string } | null;
  onInitialConversationOpened?: () => void;
}

export function ChatsScreen({ onNavigate, initialConversation, onInitialConversationOpened }: ChatsScreenProps) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const userId = user?.id || '';

  // Logic Hook
  const {
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
    chatItems,
    SYNCED_CONTACTS_KEY
  } = useChatList(userId);

  // UI Local State
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  
  // Prefill state for modal
  const [prefillData, setPrefillData] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    userId: undefined as string | undefined
  });

  // Handle Initial Conversation (Deep Links)
  useEffect(() => {
    if (initialConversation && userId) {
      const openInitialChat = async () => {
        try {
          if (initialConversation.conversationId && initialConversation.isGroup) {
            setSelectedChat({
              conversationId: initialConversation.conversationId,
              otherUserName: initialConversation.title || 'Grupo',
              isGroup: true
            });
            if (onInitialConversationOpened) onInitialConversationOpened();
            return;
          }

          const recipientId = initialConversation.recipientId;
          let conversationId = initialConversation.conversationId;

          if (!conversationId && recipientId) {
            const response = await chatService.startConversation(userId, recipientId);
            conversationId = response.conversationId;
          }

          if (!conversationId || !recipientId) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, phone')
            .eq('id', recipientId)
            .single();

          const displayName = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : (profile as any)?.phone || 'Usuario';

          setSelectedChat({
            conversationId,
            otherUserName: displayName,
            otherUserPhone: (profile as any)?.phone || '',
            otherUserId: recipientId,
            isUnknown: false,
            isGroup: false
          });

          if (onInitialConversationOpened) onInitialConversationOpened();
        } catch (e) {
          console.error('Error opening initial conversation:', e);
        }
      };
      openInitialChat();
    }
  }, [initialConversation, userId]);

  // Reactive Update for selectedChat if it converts to contact
  useEffect(() => {
    if (selectedChat?.isUnknown && selectedChat.conversationId) {
      const updatedItem = chatItems.find(item => item.conversationId === selectedChat.conversationId);
      if (updatedItem && updatedItem.type === 'contact') {
        setSelectedChat((prev: any) => prev ? ({
          ...prev,
          otherUserName: updatedItem.displayName,
          otherUserPhone: updatedItem.phone,
          isUnknown: false,
          contactId: updatedItem.contactId,
          alias: updatedItem.alias,
          customFirstName: updatedItem.customFirstName,
          customLastName: updatedItem.customLastName,
          avatarUrl: updatedItem.avatarUrl || prev.avatarUrl
        }) : null);
      }
    }
  }, [chatItems, selectedChat?.conversationId, selectedChat?.isUnknown]);

  // Handlers
  const handleItemPress = async (chat: ChatListItemType) => {
    try {
      let conversationId = chat.conversationId;
      if (!conversationId) {
        const response = await chatService.startConversation(userId, chat.otherUserId);
        conversationId = response.conversationId;
      }

      setSelectedChat({
        conversationId,
        otherUserName: chat.displayName,
        otherUserPhone: chat.phone,
        otherUserId: chat.otherUserId,
        isUnknown: chat.type === 'unknown',
        isGroup: chat.type === 'group',
        description: chat.description,
        contactId: chat.contactId,
        alias: chat.alias,
        customFirstName: chat.customFirstName,
        customLastName: chat.customLastName,
        avatarUrl: chat.avatarUrl,
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  const handleLongPress = (item: ChatListItemType) => {
    const options: any[] = [
      { text: 'Cancelar', style: 'cancel' },
    ];

    if (item.conversationId) {
      options.push({
        text: 'Eliminar Chat',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Eliminar Chat', `¿Borrar chat con ${item.displayName}?`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => deleteChat(item.conversationId!) }
          ]);
        }
      });
    }

    if (options.length > 1) {
      Alert.alert('Opciones', `¿Qué deseas hacer con ${item.displayName}?`, options);
    }
  };

  const handleBackFromChat = useCallback(() => {
    setSelectedChat(null);
    loadFromLocalCache();
    syncFromServer(false, true);
  }, [loadFromLocalCache, syncFromServer]);

  // Android Back Handler
  useEffect(() => {
    if (Platform.OS !== 'android' || !selectedChat) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackFromChat();
      return true;
    });
    return () => sub.remove();
  }, [selectedChat, handleBackFromChat]);

  // UI Render Logic
  if (selectedChat) {
    const keyboardOffset = Platform.OS === 'ios' ? 100 : 0;
    return (
      <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]} offset={keyboardOffset} dismissOnPress={false}>
        <StatusBar style={colors.statusBar} />
        <ChatView
          {...selectedChat}
          userId={userId}
          currentUser={user}
          onBack={handleBackFromChat}
          onAddContact={() => {
            if (selectedChat.otherUserPhone) {
              setPrefillData({ phone: selectedChat.otherUserPhone, firstName: '', lastName: '', userId: undefined });
              setShowAddContactModal(true);
            }
          }}
          onContactUpdate={(contact) => {
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
            setSelectedChat((prev: any) => prev ? ({ ...prev, otherUserName: contact.alias || `${contact.customFirstName} ${contact.customLastName}`.trim(), isUnknown: false }) : null);
            syncFromServer(false);
          }}
          onNavigateCall={(roomName, username, conversationId, passedUserId) => onNavigate('call', { roomName, username, conversationId, userId: passedUserId })}
        />
      </KeyboardSafeView>
    );
  }

  if (showNotifications) {
    return <NotificationsScreen userId={userId} onBack={() => setShowNotifications(false)} />;
  }

  return (
    <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.statusBar} />
      
      <ChatsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadCount={unreadNotificationCount}
        onNotificationsPress={() => setShowNotifications(true)}
        styles={styles}
      />

      {/* Banners & Progress */}
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

      {isSyncing && (
        <View style={styles.syncProgress}>
          <ActivityIndicator size="small" color="#7FA889" />
          <Text style={styles.syncProgressText}>Sincronizando... {progress?.percentage || 0}%</Text>
        </View>
      )}

      {/* Filters */}
      <View style={[styles.filtersContainer, { backgroundColor: colors.background }]}>
        {['all', 'contacts', 'groups'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, { backgroundColor: colors.surface }, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f as any)}
          >
            <Text style={[styles.filterText, { color: colors.textSecondary }, activeFilter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todos' : f === 'contacts' ? 'Contactos' : 'Grupos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error & Loading */}
      {(error || syncError) && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || syncError}</Text>
        </View>
      )}

      {isLoading && filteredItems.length === 0 && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7FA889" />
          <Text style={styles.loadingText}>Cargando chats...</Text>
        </View>
      )}

      {!isLoading && filteredItems.length === 0 && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyStateText}>No tienes chats aún</Text>
          <Text style={styles.emptyStateSubtext}>Toca + para agregar un contacto</Text>
        </View>
      )}

      {/* Chat List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            item={item}
            onPress={handleItemPress}
            onLongPress={handleLongPress}
            onAddContact={(i) => {
              const nameParts = (i.displayName || '').split(' ');
              setPrefillData({
                phone: i.phone,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' ') || '',
                userId: i.otherUserId
              });
              setShowAddContactModal(true);
            }}
            styles={styles}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadChats} colors={['#7FA889']} tintColor="#7FA889" />}
      />

      {/* FAB Overlay */}
      {showFabMenu && <TouchableOpacity style={styles.fabOverlay} activeOpacity={1} onPress={() => setShowFabMenu(false)} />}

      {/* FAB Menu */}
      {showFabMenu && (
        <View style={styles.fabMenuContainer}>
          {[
            { label: 'Nuevo grupo', icon: <InviteIcon size={24} color="#374151" />, action: () => onNavigate('new_group') },
            { label: 'Nuevo contacto', icon: <AccountIcon size={24} color="#374151" />, action: () => setShowAddContactModal(true) },
          ].map((item, idx) => (
            <View key={idx} style={styles.fabMenuItem}>
              <View style={styles.fabMenuLabel}><Text style={styles.fabMenuLabelText}>{item.label}</Text></View>
              <TouchableOpacity style={styles.fabMenuButton} onPress={() => { setShowFabMenu(false); item.action(); }}>
                {item.icon}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Main FAB */}
      <TouchableOpacity style={styles.newChatButton} onPress={() => setShowFabMenu(!showFabMenu)} activeOpacity={0.8}>
        <View style={{ transform: [{ rotate: showFabMenu ? '45deg' : '0deg' }] }}>
          <PlusIcon size={24} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      <AddContactModal
        visible={showAddContactModal}
        onClose={() => { setShowAddContactModal(false); setPrefillData({ phone: '', firstName: '', lastName: '', userId: undefined }); }}
        onContactAdded={(contact) => {
          if (contact && contact.contactUserId) {
            const newSynced = syncedContacts.filter(s => s.otherUserId !== contact.contactUserId);
            if (newSynced.length !== syncedContacts.length) {
              setSyncedContacts(newSynced);
              AsyncStorage.setItem(SYNCED_CONTACTS_KEY, JSON.stringify(newSynced)).catch(console.error);
            }
          }
          loadChats();
        }}
        userId={userId}
        initialPhone={prefillData.phone}
        initialFirstName={prefillData.firstName}
        initialLastName={prefillData.lastName}
        initialContactUserId={prefillData.userId}
        onSyncRequested={() => { setShowAddContactModal(false); setShowSyncBanner(true); handleSyncContacts(); }}
      />

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </KeyboardSafeView>
  );
}

const styles = chatsListStyles;
