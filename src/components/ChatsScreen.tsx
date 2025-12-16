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
  Animated,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../hooks/useChat';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { initChatDatabase } from '../database/chatDatabase';
import { BottomNavigation } from './BottomNavigation';
import { MagicPencilIcon } from './icons/ActionIcons'; // Check path is correct
// import { ChatInput } from './chat/ChatInput'; // Unused now
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
import { AddContactModal } from './AddContactModal';

interface ChatsScreenProps {
  onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
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
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionOpacity] = useState(new Animated.Value(0));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = React.useRef<any>(null);

  // Listen to keyboard events
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async () => {
    if (!messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    await sendMessage(content);
  };

  // Create animated component for LinearGradient
  const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

  const handleCorrection = async () => {
    if (!messageText.trim() || isCorrecting || isLoading) return;

    setIsCorrecting(true);
    // Start gradient animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(correctionOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(correctionOpacity, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    try {
      // Use the actual service
      const result = await chatService.correctMessage(messageText);
      console.log('Correction result:', result); // Debug log

      if (result && typeof result.correctedText === 'string' && result.correctedText !== messageText) {
        setMessageText(result.correctedText);
        // Success flash (yellow) is handled by a different anim if needed, 
        // but user requested gradient "loading" effect. 
        // We stop the loading animation in finally block.
      }
    } catch (error) {
      console.error('Correction failed:', error);
    } finally {
      setIsCorrecting(false);
      correctionOpacity.setValue(0); // Reset animation
    }
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
      keyboardVerticalOffset={0} // Not relying on this anymore
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

      {/* Input Area - with dynamic bottom margin when keyboard is visible */}
      <View style={[chatStyles.inputContainer, { marginBottom: keyboardHeight }]}>
        <View style={chatStyles.inputRow}>
          {/* Camera Button */}
          <TouchableOpacity style={chatStyles.mediaButton}>
            <CameraIcon size={22} color="#6B7280" />
          </TouchableOpacity>

          {/* Input Wrapper with Pencil inside */}
          <View style={[chatStyles.inputWrapper, { overflow: 'hidden' }]}>
            {/* Gradient Overlay when correcting */}
            <AnimatedGradient
              colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 105, 180, 0.3)', 'rgba(0, 191, 255, 0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                StyleSheet.absoluteFill,
                { opacity: correctionOpacity }
              ]}
            />

            <TextInput
              style={chatStyles.textInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#9CA3AF"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />

            {/* Magic Pencil - shows when text exists */}
            {messageText && messageText.length > 0 && (
              <TouchableOpacity
                style={chatStyles.pencilButton}
                onPress={handleCorrection}
                disabled={isCorrecting}
              >
                {isCorrecting ? (
                  <ActivityIndicator size="small" color="#FF69B4" />
                ) : (
                  <MagicPencilIcon size={24} />
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Correction Flash Overlay - REMOVED, passing logic to gradient inside inputWrapper */}
          {/* <Animated.View ... /> */}

          {/* Mic or Send Button */}
          {messageText.trim() ? (
            <TouchableOpacity
              style={[chatStyles.sendButton, isCorrecting && { backgroundColor: '#9CA3AF' }]}
              onPress={handleSend}
              disabled={isCorrecting}
            >
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
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 12, // Reduced padding to accommodate icon
    minHeight: 40,
  },
  textInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    color: '#111827',
  },
  pencilButton: {
    marginLeft: 4,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  correctionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 235, 59, 0.2)', // Yellow flash
    borderRadius: 24,
    // Adjust position to match the inputWrapper (which is the middle child of inputRow)
    top: 12,
    bottom: 12,
    left: 64, // 16 pad + 40 media + 8 gap. Approx.
    right: 64, // 16 pad + 40 send + 8 gap.
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

  const [users, setUsers] = useState<Contact[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChat, setSelectedChat] = useState<{
    conversationId: string;
    otherUserName: string;
  } | null>(null);

  // Modal state
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    initChatDatabase();
  }, []);

  // Load contacts (not all users anymore)
  const loadContacts = useCallback(async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('📡 Fetching contacts for user:', userId);
      const response = await contactService.getContacts();
      console.log('📡 Got contacts:', response.contacts?.length || 0);
      setUsers(response.contacts || []);
      setFilteredUsers(response.contacts || []);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError('Error al cargar contactos');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredUsers(users);
      return;
    }
    const filtered = users.filter(
      (u) =>
        u.alias?.toLowerCase().includes(text.toLowerCase()) ||
        u.customFirstName?.toLowerCase().includes(text.toLowerCase()) ||
        u.customLastName?.toLowerCase().includes(text.toLowerCase()) ||
        u.phone?.includes(text)
    );
    setFilteredUsers(filtered);
  };

  // Handle contact tap - start or get conversation
  const handleContactPress = async (contact: Contact) => {
    try {
      console.log('🚀 Starting conversation with contact:', contact.contactUserId);
      const response = await chatService.startConversation(userId, contact.contactUserId);
      console.log('✅ Got conversationId:', response.conversationId);

      // Use alias or custom name for chat header
      const displayName = contact.alias ||
        `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
        contact.phone;

      setSelectedChat({
        conversationId: response.conversationId,
        otherUserName: displayName,
      });
    } catch (err) {
      console.error('Error starting conversation:', err);
      setError('Error al iniciar conversación');
    }
  };

  // Handle back from chat
  const handleBack = () => {
    setSelectedChat(null);
    loadContacts();
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
          <Text style={styles.loadingText}>Cargando contactos...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && filteredUsers.length === 0 && !error && (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyStateText}>No tienes contactos aún</Text>
          <Text style={styles.emptyStateSubtext}>Toca + para agregar uno</Text>
        </View>
      )}

      {/* Contacts List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactListItem contact={item} onPress={() => handleContactPress(item)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadContacts}
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
        onClose={() => setShowAddContactModal(false)}
        onContactAdded={loadContacts}
      />

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
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
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
