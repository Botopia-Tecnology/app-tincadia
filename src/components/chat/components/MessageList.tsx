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
  status: 'uploading' | 'failed';
  createdAt: string;
  senderId: string;
  metadata?: { duration?: number; isVideoNote?: boolean };
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
  onNeedUpgrade?: (feature: 'transcription' | 'transcription_blocked') => void;
  onRetryUpload?: (msg: UploadingMessage) => void;
  onDismissUpload?: (msgId: string) => void;
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
  readReceiptsEnabled = true,
  onNeedUpgrade,
  onRetryUpload,
  onDismissUpload,
}: MessageListProps) => {
  const terminalCallTypes = useMemo(() => {
    return new Set(isGroup ? ['call_ended', 'call_missed'] : ['call_ended', 'call_rejected', 'call_missed']);
  }, [isGroup]);

  const getNormalizedSessionId = (m: Message): string | undefined => {
    const meta = typeof m.metadata === 'string' ? (() => { try { return JSON.parse(m.metadata); } catch { return {}; } })() : (m.metadata || {});
    const sid = meta.callSessionId || meta.call_session_id;
    return typeof sid === 'string' && sid.trim() ? sid.trim().toLowerCase() : undefined;
  };

  const getNormalizedRoomName = (m: Message): string | undefined => {
    const meta = typeof m.metadata === 'string' ? (() => { try { return JSON.parse(m.metadata); } catch { return {}; } })() : (m.metadata || {});
    return typeof meta.roomName === 'string' && meta.roomName.trim() ? meta.roomName.trim().toLowerCase() : undefined;
  };

  const endedCallSessionIds = useMemo(() => {
    const endedSessions = new Set<string>();

    messages.forEach((message) => {
      if (!terminalCallTypes.has(message.type)) return;

      const sessionId = getNormalizedSessionId(message);
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
    if ('status' in item && (item.status === 'uploading' || item.status === 'failed')) {
      const uploader = item as UploadingMessage;
      const isFailed = uploader.status === 'failed';
      return (
        <View style={{ opacity: isFailed ? 1 : 0.7 }}>
          <MessageBubble
            content={uploader.localUri}
            time={uploader.createdAt}
            isMine={true}
            isSynced={false}
            type={uploader.type}
            duration={uploader.metadata?.duration}
            metadata={uploader.metadata}
            onNeedUpgrade={onNeedUpgrade}
          />
          {!isFailed && (
            <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: '40%' }} color="white" />
          )}
          {isFailed && (
            <View style={{ position: 'absolute', alignSelf: 'center', top: '30%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 12 }}>
              <Ionicons name="cloud-offline" size={24} color="#ff4444" />
              <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
                <TouchableOpacity onPress={() => onRetryUpload?.(uploader)} style={{ padding: 6, backgroundColor: colors.primary, borderRadius: 6 }}>
                  <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>Reintentar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDismissUpload?.(uploader.id)} style={{ padding: 6, backgroundColor: '#444', borderRadius: 6 }}>
                  <Text style={{ color: 'white', fontSize: 12 }}>Descartar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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

      const callTime = getSafeTime(msg.createdAt);
      const isExpired = callTime > 0 && (Date.now() - callTime) > CALL_EXPIRY_MS;

      const callSessionId = getNormalizedSessionId(msg);
      const roomName = getNormalizedRoomName(msg);
      const hasEndedBySession = Boolean(callSessionId && endedCallSessionIds.has(callSessionId));
      const callIndex = messages.findIndex(m => m.id === msg.id);
      const nextCallIndex = messages.findIndex((m, index) => index > callIndex && m.type === 'call');
      const nextCallTime = nextCallIndex >= 0 ? getSafeTime(messages[nextCallIndex].createdAt) : 0;

      const hasEndedByFallback = messages.some((m, index) => {
        if (!terminalCallTypes.has(m.type)) return false;

        if (callIndex >= 0 && index <= callIndex) return false;
        if (nextCallIndex >= 0 && index >= nextCallIndex) return false;

        const endingSessionId = getNormalizedSessionId(m);
        if (callSessionId && endingSessionId && endingSessionId !== callSessionId) return false;

        const endingRoomName = getNormalizedRoomName(m);
        if (roomName && endingRoomName && endingRoomName !== roomName) return false;

        const endingTime = getSafeTime(m.createdAt);
        if (callTime > 0 && endingTime > 0 && endingTime < callTime) return false;
        if (nextCallTime > 0 && endingTime > 0 && endingTime > nextCallTime) return false;

        return true;
      });

      const hasEnded = isExpired || hasEndedBySession || hasEndedByFallback || msg.id !== latestCallMessageId;

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
            content={msg.content}
            time={msg.createdAt}
            isMine={isMe}
            isSynced={msg.status !== 'pending'}
            isRead={false}
            type="text"
            metadata={msg.metadata}
          />
        </View>
      );
    }

    return (
      <Swipeable
        ref={(ref) => { if (ref) swipeableRefs.current.set(msg.id, ref); }}
        enabled={!isDeleted}
        renderRightActions={() => (
          <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="arrow-undo" size={24} color={colors.textMuted} />
          </View>
        )}
        onSwipeableWillOpen={() => {
          onSwipeReply(msg);
          Vibration.vibrate(50);
          const swipeable = swipeableRefs.current.get(msg.id);
          if (swipeable) swipeable.close();
        }}
      >
        <Pressable 
          onLongPress={() => !isDeleted && onLongPress(msg)}
          delayLongPress={250}
        >
          <MessageBubble
            content={msg.content}
            time={msg.createdAt}
            isMine={isMe}
            isSynced={msg.status !== 'pending'}
            isRead={msg.status === 'read' && readReceiptsEnabled !== false}
            type={(msg.type as "image" | "video" | "call_ended" | "call_rejected" | "call_missed" | "call" | "text" | "audio") || 'text'}
            replyToContent={msg.replyToContent}
            replyToSender={
              msg.replyToSender
                ? ((msg.metadata?.replyToSenderId as string) === userId ? 'Tú' : msg.replyToSender)
                : undefined
            }
            publicId={msg.metadata?.publicId}
            duration={msg.metadata?.duration}
            senderName={isGroup && !isMe ? msg.senderName : undefined}
            updatedAt={msg.updatedAt}
            readAt={msg.readAt}
            metadata={msg.metadata}
            onNeedUpgrade={onNeedUpgrade}
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
