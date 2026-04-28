import React from 'react';
import { View, Text, FlatList, Pressable, Vibration, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from './MessageBubble';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { Message } from '../../hooks/useChat';
import { ThemeColors } from '../../contexts/ThemeContext';

interface UploadingMessage {
  id: string;
  content: string;
  localUri: string;
  type: 'image' | 'video';
  status: 'uploading';
  createdAt: string;
  senderId: string;
  metadata?: { duration?: number };
}

interface MessageListProps {
  messages: Message[];
  uploadingMessages: UploadingMessage[];
  userId: string;
  isGroup?: boolean;
  onLongPress: (msg: Message) => void;
  onSwipeReply: (msg: Message) => void;
  onJoinCall: () => void;
  colors: ThemeColors;
  isDark: boolean;
  swipeableRefs: React.MutableRefObject<Map<string, Swipeable | null>>;
  readReceiptsEnabled?: boolean;
}

export const MessageList = ({
  messages,
  uploadingMessages,
  userId,
  isGroup = false,
  onLongPress,
  onSwipeReply,
  onJoinCall,
  colors,
  isDark,
  swipeableRefs,
  readReceiptsEnabled = true
}: MessageListProps) => {

  const renderMessageItem = ({ item }: { item: Message | UploadingMessage }) => {
    if ('status' in item && item.status === 'uploading') {
      const uploader = item as UploadingMessage;
      return (
        <View style={{ opacity: 0.7 }}>
          <MessageBubble
            content={uploader.localUri}
            time={uploader.createdAt}
            isMine={true}
            isSynced={false}
            type={uploader.type}
            duration={uploader.metadata?.duration}
          />
          <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: '40%' }} color="white" />
        </View>
      );
    }

    const msg = item as Message;
    const isMe = msg.senderId === userId;

    if (msg.type === 'call') {
      const CALL_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes

      const getSafeTime = (dateStr: string) => {
        if (!dateStr) return 0;
        const safe = dateStr.replace(' ', 'T');
        return new Date(safe).getTime() || 0;
      };

      const callTime = getSafeTime(item.createdAt);
      const isExpired = callTime > 0 && (Date.now() - callTime) > CALL_EXPIRY_MS;

      const hasEnded = isExpired || messages.some(m =>
        (m.type === 'call_ended' || m.type === 'call_rejected') &&
        getSafeTime(m.createdAt) > callTime
      );

      return (
        <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
          <View style={{ backgroundColor: isDark ? '#1E1E3F' : '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>Videollamada</Text>
            <Text style={{ marginBottom: 10, color: colors.textSecondary }}>{isMe ? 'Iniciaste una llamada' : 'Te invitaron a una llamada'}</Text>
            {!hasEnded ? (
              <TouchableOpacity onPress={onJoinCall} style={{ backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Unirse ahora</Text>
              </TouchableOpacity>
            ) : (
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 12 }}>Llamada finalizada</Text>
            )}
          </View>
        </View>
      );
    }

    const isDeleted = msg.deletedAt;
    const isSystemActivity =
      msg.type === 'text' &&
      msg.metadata &&
      typeof msg.metadata === 'object' &&
      msg.metadata.isSystem === true;

    if (isSystemActivity) {
      return (
        <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center' }]}>
          <MessageBubble
            content={item.content}
            time={item.createdAt}
            isMine={isMe}
            isSynced={item.status !== 'pending'}
            isRead={false}
            type="text"
            metadata={item.metadata}
          />
        </View>
      );
    }

    return (
      <Swipeable
        ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); }}
        enabled={!isDeleted}
        renderRightActions={() => (
          <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="arrow-undo" size={24} color={colors.textMuted} />
          </View>
        )}
        onSwipeableWillOpen={() => {
          onSwipeReply(item);
          Vibration.vibrate(50);
          const swipeable = swipeableRefs.current.get(item.id);
          if (swipeable) swipeable.close();
        }}
      >
        <Pressable 
          onLongPress={() => !isDeleted && onLongPress(item)}
          delayLongPress={250}
        >
          <MessageBubble
            content={item.content}
            time={item.createdAt}
            isMine={isMe}
            isSynced={item.status !== 'pending'}
            isRead={item.status === 'read' && readReceiptsEnabled !== false}
            type={(item.type as "image" | "video" | "call_ended" | "call" | "text" | "audio") || 'text'}
            replyToContent={item.replyToContent}
            replyToSender={
              item.replyToSender
                ? ((item.metadata?.replyToSenderId as string) === userId ? 'Tú' : item.replyToSender)
                : undefined
            }
            publicId={item.metadata?.publicId}
            duration={item.metadata?.duration}
            senderName={isGroup && !isMe ? item.senderName : undefined}
            updatedAt={item.updatedAt}
            readAt={item.readAt}
            metadata={item.metadata}
          />
        </Pressable>
      </Swipeable>
    );
  };

  const displayData = [...uploadingMessages, ...[...messages].filter(m => m.type !== 'call_rejected' && m.type !== 'sos_active' && m.type !== 'call_ended').reverse()];

  return (
    <FlatList
      data={displayData}
      inverted
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 16 }}
      style={[chatViewStyles.messagesContainer, { backgroundColor: colors.background }]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={
        <View style={chatViewStyles.emptyContainer}>
          <Text style={[chatViewStyles.emptyText, { color: colors.text }]}>No hay mensajes aún</Text>
          <Text style={[chatViewStyles.emptySubtext, { color: colors.textSecondary }]}>¡Envía el primero!</Text>
        </View>
      }
      renderItem={renderMessageItem}
    />
  );
};
