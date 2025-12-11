/**
 * Chats Screen
 * 
 * Modern chat list design with search and floating new chat button.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { chatService, AvailableUser } from '../services/chat.service';
import { initChatDatabase } from '../database/chatDatabase';
import { BottomNavigation } from './BottomNavigation';
import { ChatInput } from './chat/ChatInput';
import { MessageBubble } from './chat/MessageBubble';
import {
  BackArrowIcon,
  NotificationIcon,
  SearchIcon,
  CameraIcon,
  MicrophoneIcon,
  SendIcon,
  PlusIcon,
} from './icons/NavigationIcons';

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
      {/* Avatar with initials */}
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarText}>
          {user.firstName?.[0] || '?'}
          {user.lastName?.[0] || ''}
        </Text>
      </View>

      {/* User Info */}
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>
            {user.firstName} {user.lastName}
          </Text>
          <Text style={styles.timestamp}>Nuevo</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {user.phone || 'Toca para chatear'}
          </Text>
        </View>
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
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = React.useRef<any>(null);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    await sendMessage(content);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Get initials for avatar
  const initials = otherUserName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={chatStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={chatStyles.header}>
        <TouchableOpacity onPress={onBack} style={chatStyles.backBtn}>
          <BackArrowIcon size={24} color="#7FA889" />
        </TouchableOpacity>
        <View style={chatStyles.avatarSmall}>
          <Text style={chatStyles.avatarSmallText}>{initials}</Text>
        </View>
        <View style={chatStyles.headerInfo}>
          <Text style={chatStyles.headerName}>{otherUserName}</Text>
          <Text style={chatStyles.headerStatus}>En línea</Text>
        </View>
      </View>

      {/* Messages */}
      {isLoading && messages.length === 0 ? (
        <View style={chatStyles.loadingContainer}>
          <ActivityIndicator size="large" color="#7FA889" />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={chatStyles.messagesContainer}
          contentContainerStyle={chatStyles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={chatStyles.emptyContainer}>
              <Text style={chatStyles.emptyText}>No hay mensajes aún</Text>
              <Text style={chatStyles.emptySubtext}>¡Envía el primero!</Text>
            </View>
          ) : (
            messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  chatStyles.messageBubbleContainer,
                  msg.isMine ? chatStyles.myMessage : chatStyles.theirMessage,
                ]}
              >
                <View
                  style={[
                    chatStyles.messageBubble,
                    msg.isMine ? chatStyles.myBubble : chatStyles.theirBubble,
                  ]}
                >
                  <Text
                    style={[
                      chatStyles.messageText,
                      msg.isMine ? chatStyles.myMessageText : chatStyles.theirMessageText,
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
                <Text
                  style={[
                    chatStyles.messageTime,
                    msg.isMine ? chatStyles.myTime : chatStyles.theirTime,
                  ]}
                >
                  {formatTime(msg.createdAt)}
                  {msg.isMine && !msg.isSynced && ' ⏳'}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Input Area */}
      <View style={chatStyles.inputContainer}>
        <View style={chatStyles.inputRow}>
          {/* Camera Button */}
          <TouchableOpacity style={chatStyles.mediaButton}>
            <CameraIcon size={22} color="#6B7280" />
          </TouchableOpacity>

          {/* Text Input */}
          <TextInput
            style={chatStyles.textInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#9CA3AF"
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={500}
          />

          {/* Mic or Send Button */}
          {messageText.trim() ? (
            <TouchableOpacity style={chatStyles.sendButton} onPress={handleSend}>
              <SendIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={chatStyles.micButton}>
              <MicrophoneIcon size={22} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Chat View Styles
const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7FA889',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerStatus: {
    fontSize: 14,
    color: '#10B981',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  messageBubbleContainer: {
    marginBottom: 8,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
  },
  theirMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#7FA889',
    borderTopRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B7280',
  },
  myTime: {
    textAlign: 'right',
  },
  theirTime: {
    textAlign: 'left',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7FA889',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Main Chats Screen
export function ChatsScreen({ onNavigate }: ChatsScreenProps) {
  const { user } = useAuth();
  const userId = user?.id || '';

  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AvailableUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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
      setFilteredUsers(response.users || []);
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

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter(
      (u) =>
        u.firstName?.toLowerCase().includes(text.toLowerCase()) ||
        u.lastName?.toLowerCase().includes(text.toLowerCase()) ||
        u.phone?.includes(text)
    );
    setFilteredUsers(filtered);
  };

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
    loadUsers();
  };

  // Show individual chat if selected
  if (selectedChat) {
    return (
      <SafeAreaView style={styles.container}>
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

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading State */}
      {isLoading && users.length === 0 && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#7FA889" />
          <Text style={styles.loadingText}>Cargando usuarios...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && filteredUsers.length === 0 && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyStateText}>No se encontraron chats</Text>
        </View>
      )}

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem user={item} onPress={() => handleUserPress(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadUsers}
            colors={['#7FA889']}
            tintColor="#7FA889"
          />
        }
      />

      {/* New Chat Floating Button */}
      <TouchableOpacity style={styles.newChatButton} onPress={loadUsers}>
        <PlusIcon size={24} color="#FFFFFF" />
      </TouchableOpacity>

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  notificationButton: {
    padding: 8,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
  },

  // Chat Item
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7FA889',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
    marginLeft: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timestamp: {
    fontSize: 14,
    color: '#6B7280',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#7FA889',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },

  // List
  listContent: {
    paddingBottom: 100,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  // States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
  },

  // New Chat Button
  newChatButton: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#7FA889',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  newChatIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
  },

  // Chat View
  chatViewContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  chatViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  chatViewTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
});
