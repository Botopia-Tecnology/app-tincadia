import React from 'react';
import { View, Text, FlatList, Pressable, Vibration, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from './MessageBubble';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';

interface MessageListProps {
  messages: any[];
  uploadingMessages: any[];
  userId: string;
  onLongPress: (msg: any) => void;
  onSwipeReply: (msg: any) => void;
  onJoinCall: () => void;
  colors: any;
  isDark: boolean;
  swipeableRefs: React.MutableRefObject<Map<string, Swipeable | null>>;
}

export const MessageList = ({
  messages,
  uploadingMessages,
  userId,
  onLongPress,
  onSwipeReply,
  onJoinCall,
  colors,
  isDark,
  swipeableRefs
}: MessageListProps) => {

  const renderMessageItem = ({ item }: { item: any }) => {
    if (item.status === 'uploading') {
      return (
        <View style={{ opacity: 0.7 }}>
          <MessageBubble
            content={item.localUri}
            time={item.createdAt}
            isMine={true}
            isSynced={false}
            type={item.type}
            duration={item.metadata?.duration}
          />
          <ActivityIndicator style={{ position: 'absolute', alignSelf: 'center', top: '40%' }} color="white" />
        </View>
      );
    }

    const isMe = item.senderId === userId;

    if (item.type === 'call') {
      const hasEnded = messages.some(m =>
        m.type === 'call_ended' &&
        new Date(m.createdAt).getTime() > new Date(item.createdAt).getTime()
      );
      return (
        <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
          <View style={{ backgroundColor: isDark ? '#1E1E3F' : '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5, color: colors.text }}>📞 Videollamada</Text>
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

    if (item.type === 'call_ended') {
      return (
        <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
          <View style={{ backgroundColor: isDark ? '#2A2A2A' : '#F3F4F6', padding: 10, borderRadius: 15, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>📞 Videollamada finalizada</Text>
          </View>
        </View>
      );
    }

    return (
      <Swipeable
        ref={(ref) => { if (ref) swipeableRefs.current.set(item.id, ref); }}
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
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={250}>
          <MessageBubble
            content={item.content}
            time={item.createdAt}
            isMine={isMe}
            isSynced={item.status !== 'pending'}
            isRead={item.status === 'read'}
            type={item.type || 'text'}
            replyToContent={item.replyToContent}
            replyToSender={item.replyToSender}
            publicId={item.metadata?.publicId}
            duration={item.metadata?.duration}
          />
        </Pressable>
      </Swipeable>
    );
  };

  const displayData = [...uploadingMessages, ...[...messages].filter(m => m.type !== 'call_rejected' && m.type !== 'sos_active').reverse()];

  return (
    <FlatList
      data={displayData}
      inverted
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 16 }}
      style={[chatViewStyles.messagesContainer, { backgroundColor: colors.background }]}
      keyboardDismissMode="on-drag"
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
