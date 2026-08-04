import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable, Vibration, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from './MessageBubble';
import { chatViewStyles } from '../../../styles/ChatsScreen.styles';
import { Message } from '../../../hooks/useChat';
import { ThemeColors } from '../../../contexts/ThemeContext';

interface UploadingMessage {
  id: string;
  content: string;
  localUri: string;
  type: 'image' | 'video' | 'document' | 'audio';
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
  onJoinCall: (msg: Message) => void;
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
  const terminalCallTypes = useMemo(() => {
    return new Set(isGroup ? ['call_ended', 'call_missed'] : ['call_ended', 'call_rejected', 'call_missed']);
  }, [isGroup]);

  const endedCallSessionIds = useMemo(() => {
    const endedSessions = new Set<string>();

    messages.forEach((message) => {
      if (!terminalCallTypes.has(message.type)) return;

      const sessionId = typeof message.metadata?.callSessionId === 'string'
        ? message.metadata.callSessionId
        : undefined;

      if (sessionId) {
        endedSessions.add(sessionId);
      }
    });

    return endedSessions;
  }, [messages, terminalCallTypes]);

  // Only one call can be active/pending per conversation: any 'call' message
  // older than the latest one renders as ended even if its terminal event was
  // lost (e.g. while the app was in background).
  const latestCallMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'call') return messages[i].id;
    }
    return undefined;
  }, [messages]);

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
      // Fallback, no el mecanismo principal: la llamada termina cuando llega
      // un terminal (lo emite quien cuelga de últimas o el último humano al
      // auto-cerrarse). El TTL solo cubre el caso extremo de que ese terminal
      // nunca llegue (todos los teléfonos murieron a la vez), y es largo para
      // que en llamadas grupales extensas quien salió pueda reingresar con
      // "Unirse ahora" mientras la llamada siga viva.
      const CALL_EXPIRY_MS = 60 * 60 * 1000; // 60 minutos

      const getSafeTime = (dateStr: string) => {
        if (!dateStr) return 0;
        const safe = dateStr.replace(' ', 'T');
        return new Date(safe).getTime() || 0;
      };

      const callTime = getSafeTime(item.createdAt);
      const isExpired = callTime > 0 && (Date.now() - callTime) > CALL_EXPIRY_MS;

      const callSessionId = typeof msg.metadata?.callSessionId === 'string' ? msg.metadata.callSessionId : undefined;
      const roomName = typeof msg.metadata?.roomName === 'string' ? msg.metadata.roomName : undefined;
      const hasEndedBySession = Boolean(callSessionId && endedCallSessionIds.has(callSessionId));
      const callIndex = messages.findIndex(m => m.id === msg.id);
      const nextCallIndex = messages.findIndex((m, index) => index > callIndex && m.type === 'call');
      const nextCallTime = nextCallIndex >= 0 ? getSafeTime(messages[nextCallIndex].createdAt) : 0;

      const hasEndedByLegacyFallback = messages.some((m, index) => {
        if (!terminalCallTypes.has(m.type)) return false;

        const endingSessionId = typeof m.metadata?.callSessionId === 'string' ? m.metadata.callSessionId : undefined;
        if (endingSessionId) return false;

        if (callIndex >= 0 && index <= callIndex) return false;
        if (nextCallIndex >= 0 && index >= nextCallIndex) return false;

        const endingTime = getSafeTime(m.createdAt);
        if (endingTime < callTime) return false;
        if (nextCallTime > 0 && endingTime > nextCallTime) return false;

        const endingRoomName = typeof m.metadata?.roomName === 'string' ? m.metadata.roomName : undefined;
        if (roomName && endingRoomName && endingRoomName !== roomName) return false;

        // Legacy fallback: some persisted/broadcast end events arrive without callSessionId.
        // Bind them only to the message window of this call so fast repeated calls stay independent.
        return true;
      });

      const hasEnded = isExpired || hasEndedBySession || hasEndedByLegacyFallback || msg.id !== latestCallMessageId;

      if (hasEnded) {
        return (
          <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
            <View style={{ backgroundColor: isDark ? '#2A2A35' : '#F3F4F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="call" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 13 }}>Llamada finalizada</Text>
            </View>
          </View>
        );
      }

      return (
        <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
          <View style={{ backgroundColor: isDark ? '#1E1E3F' : '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>Videollamada</Text>
            <Text style={{ marginBottom: 10, color: colors.textSecondary }}>{isMe ? 'Iniciaste una llamada' : 'Te invitaron a una llamada'}</Text>
            <TouchableOpacity onPress={() => onJoinCall(msg)} style={{ backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Unirse ahora</Text>
            </TouchableOpacity>
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
            type={(item.type as "image" | "video" | "call_ended" | "call_rejected" | "call_missed" | "call" | "text" | "audio") || 'text'}
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

  const displayData = [...uploadingMessages, ...[...messages].filter(m => m.type !== 'call_rejected' && m.type !== 'sos_active' && m.type !== 'call_ended' && m.type !== 'call_missed').reverse()];

  return (
    <FlatList
      data={displayData}
      extraData={messages}
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
