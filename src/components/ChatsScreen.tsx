/**
 * Chats Screen
 * 
 * Shows either:
 * 1. List of available users to chat with (new flow)
 * 2. Individual chat when a user is selected
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { chatService, AvailableUser } from '../services/chat.service';
import { initChatDatabase } from '../database/chatDatabase';
import { chatsScreenStyles as styles } from '../styles/ChatsScreen.styles';
import {
  BackArrowIcon,
  VideoCallIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';
import { ChatInput } from './chat/ChatInput';
import { MessageBubble } from './chat/MessageBubble';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
}

// User List Item Component
function UserListItem({
  user,
  onPress,
}: {
  user: AvailableUser;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.chatItem} onPress={onPress}>
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: '#4CAF50',
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
          {user.firstName?.[0] || '?'}
          {user.lastName?.[0] || ''}
        </Text>
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>
            {user.firstName} {user.lastName}
          </Text>
        </View>
        <Text style={styles.lastMessage}>{user.phone || 'Tap to chat'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Individual Chat View
function ChatView({
  conversationId,
  otherUserName,
  userId,
  onBack,
}: {
  conversationId: string;
  otherUserName: string;
  userId: string;
  onBack: () => void;
}) {
  const { messages, sendMessage, isLoading } = useChat(conversationId, userId);
  const flatListRef = React.useRef<FlatList>(null);

  const handleSend = async (content: string) => {
    await sendMessage(content);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F8F8' }}>
      {/* Chat Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <BackArrowIcon size={20} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{otherUserName}</Text>
        <TouchableOpacity style={styles.videoButton}>
          <VideoCallIcon size={24} color="#000000" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading && messages.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              content={item.content}
              time={item.createdAt}
              isMine={item.isMine}
              isSynced={item.isSynced}
            />
          )}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#666', fontSize: 16 }}>No hay mensajes aún</Text>
              <Text style={{ color: '#999', fontSize: 14, marginTop: 4 }}>
                ¡Envía el primero!
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} />
    </View>
  );
}

// Main Chats Screen
export function ChatsScreen({ onNavigate }: ChatsScreenProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id || '';

  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for selected conversation
  const [selectedChat, setSelectedChat] = useState<{
    conversationId: string;
    otherUserName: string;
  } | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initChatDatabase();
  }, []);

  // Load available users
  const loadUsers = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Fetching available users for:', userId);
      const response = await chatService.getAvailableUsers(userId);
      console.log('📡 Got users:', response.users?.length || 0);
      setUsers(response.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle user tap - start or get conversation
  const handleUserPress = async (selectedUser: AvailableUser) => {
    try {
      console.log('🚀 Starting conversation with:', selectedUser.id);
      const response = await chatService.startConversation(userId, selectedUser.id);
      console.log('✅ Got conversationId:', response.conversationId);

      setSelectedChat({
        conversationId: response.conversationId,
        otherUserName: `${selectedUser.firstName} ${selectedUser.lastName}`,
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Error al iniciar conversación');
    }
  };

  // Handle back from chat
  const handleBack = () => {
    setSelectedChat(null);
    loadUsers(); // Refresh user list
  };

  // Show individual chat if selected
  if (selectedChat) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ChatView
          conversationId={selectedChat.conversationId}
          otherUserName={selectedChat.otherUserName}
          userId={userId}
          onBack={handleBack}
        />
      </SafeAreaView>
    );
  }

  // Show user list
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.backButton} />
        <Text style={styles.headerTitle}>{t('chats.title')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.videoButton}>
            <VideoCallIcon size={24} color="#000000" />
          </TouchableOpacity>
          <Image
            source={require('../../assets/user.png')}
            style={styles.headerProfile}
          />
        </View>
      </View>

      {/* Error Message */}
      {error && (
        <View style={{ backgroundColor: '#FFE5E5', padding: 12, marginHorizontal: 16, borderRadius: 8 }}>
          <Text style={{ color: '#CC0000', textAlign: 'center' }}>{error}</Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading && users.length === 0 && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={{ marginTop: 12, color: '#666' }}>Cargando usuarios...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && users.length === 0 && !error && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>👥</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>
            No hay usuarios disponibles
          </Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
            No hay otros usuarios registrados para chatear
          </Text>
        </View>
      )}

      {/* Users List */}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem user={item} onPress={() => handleUserPress(item)} />
        )}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadUsers}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      />

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}
