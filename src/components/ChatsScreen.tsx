/**
 * Chats Screen
 * 
 * Main chat screen that shows conversation list or individual chat.
 * Integrates with local SQLite for instant loading and Supabase for real-time.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useConversations, Conversation } from '../hooks/useConversations';
import { useChat } from '../hooks/useChat';
import { initChatDatabase } from '../database/chatDatabase';
import { chatsScreenStyles as styles } from '../styles/ChatsScreen.styles';
import {
  BackArrowIcon,
  VideoCallIcon,
  VoiceIcon,
  PhotoIcon,
  CheckIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';
import { ChatInput } from './chat/ChatInput';
import { MessageBubble } from './chat/MessageBubble';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
}

// Chat List Item Component
function ChatListItem({
  conversation,
  onPress
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  // Format time
  const formatTime = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
    }
  };

  return (
    <TouchableOpacity style={styles.chatItem} onPress={onPress}>
      <Image
        source={{ uri: conversation.otherUserAvatar || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
        defaultSource={require('../../assets/icon.png')}
      />
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{conversation.otherUserName || 'Usuario'}</Text>
          <Text style={styles.timestamp}>{formatTime(conversation.lastMessageAt)}</Text>
        </View>
        <View style={styles.messageRow}>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {conversation.lastMessage || 'Sin mensajes'}
          </Text>
          {conversation.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conversation.unreadCount}</Text>
            </View>
          )}
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
              <Text style={{ color: '#999', fontSize: 14, marginTop: 4 }}>¡Envía el primero!</Text>
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

  const { conversations, refresh, isLoading } = useConversations(userId);

  // State for selected conversation
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initChatDatabase();
  }, []);

  // Handle back from chat
  const handleBack = () => {
    setSelectedConversation(null);
    refresh(); // Refresh list when coming back
  };

  // Show individual chat if conversation selected
  if (selectedConversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ChatView
          conversationId={selectedConversation.id}
          otherUserName={selectedConversation.name}
          userId={userId}
          onBack={handleBack}
        />
      </SafeAreaView>
    );
  }

  // Show conversation list
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

      {/* Loading State */}
      {isLoading && conversations.length === 0 && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={{ marginTop: 12, color: '#666' }}>Cargando conversaciones...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && conversations.length === 0 && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>No tienes conversaciones</Text>
          <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 }}>
            Inicia un chat con alguien para comenzar a conversar
          </Text>
        </View>
      )}

      {/* Conversations List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            conversation={item}
            onPress={() => setSelectedConversation({
              id: item.id,
              name: item.otherUserName,
            })}
          />
        )}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
      />

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}
