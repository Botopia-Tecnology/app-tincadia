import React from 'react';
import { View, Text, TouchableOpacity, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlusIcon } from '../../icons/NavigationIcons';
import { ChatListItem as ChatListItemType } from '../../../hooks/useChatList';
import { useTheme } from '../../../contexts/ThemeContext';
import { chatListItemPreviewStyles as previewStyles } from '../../../styles/ChatComponents.styles';

// Format message time for display (moved from ChatsScreen)
export const formatMessageTime = (dateString: string): string => {
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

interface ChatListItemProps {
  item: ChatListItemType;
  onPress: (item: ChatListItemType) => void;
  onLongPress: (item: ChatListItemType) => void;
  onAddContact?: (item: ChatListItemType) => void;
  styles: Record<string, ViewStyle | TextStyle | ImageStyle>;
}

export const ChatListItem = ({ item, onPress, onLongPress, onAddContact, styles }: ChatListItemProps) => {
  const { colors } = useTheme();
  
  const initials = (item.displayName || '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  const renderLastMessage = (): React.ReactNode => {
    if (!item.lastMessage) {
      return <Text style={[styles.lastMessage, { color: colors.textSecondary }]}>{item.phone}</Text>;
    }

    if (/\u{1F4DE}/u.test(item.lastMessage) || item.lastMessage.toLowerCase().includes('llamada')) {
      const isEnded = item.lastMessage.toLowerCase().match(/(finalizada|rechazada|perdida)/);
      const sanitizedCallText = item.lastMessage
        .replace(/\u{1F4DE}\s?/gu, '')
        .replace(/\u260E\uFE0F?\s?/g, '')
        .trim();
      const displayText = isEnded
        ? sanitizedCallText
        : item.hasActiveIncomingCall
          ? 'Llamada entrante'
          : (sanitizedCallText || 'Llamada');
      const iconColor = isEnded ? '#EF4444' : item.hasActiveIncomingCall ? '#3B82F6' : colors.textSecondary;
      
      return (
        <View style={previewStyles.row}>
          <Ionicons name={isEnded || !item.hasActiveIncomingCall ? 'call-outline' : 'call'} size={14} color={iconColor} />
          <Text style={[previewStyles.label, { color: iconColor }]}>{displayText}</Text>
        </View>
      );
    }

    const isMediaUrl = item.lastMessage.startsWith('http') || item.lastMessage.startsWith('uploads/');

    if (isMediaUrl && (item.lastMessage.includes('/chat-media/') || item.lastMessage.match(/\.(jpg|jpeg|png|gif|webp)/i))) {
      return (
        <View style={previewStyles.row}>
          <Ionicons name="image-outline" size={14} color={colors.textSecondary} />
          <Text style={[previewStyles.label, { color: colors.textSecondary }]}>Imagen</Text>
        </View>
      );
    }

    if (isMediaUrl && item.lastMessage.match(/\.(m4a|mp3|wav|ogg|aac)/i)) {
      return (
        <View style={previewStyles.row}>
          <Ionicons name="mic-outline" size={14} color={colors.textSecondary} />
          <Text style={[previewStyles.label, { color: colors.textSecondary }]}>Audio</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={[styles.chatItemRow, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: colors.background }]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={500}
      >
        <View style={[
          styles.avatarContainer,
          item.type === 'unknown' && { backgroundColor: '#9CA3AF' },
          item.type === 'synced' && { backgroundColor: '#3B82F6' },
          item.avatarUrl ? { backgroundColor: 'transparent' } : {}
        ]}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, { color: colors.text }]}>{item.displayName}</Text>
            <Text style={[styles.timestamp, item.type === 'synced' && { color: '#3B82F6' }]}>
              {item.type === 'synced'
                ? '\u2713 En Tincadia'
                : item.lastMessageTime
                  ? formatMessageTime(item.lastMessageTime)
                  : item.type === 'unknown' ? 'Desconocido' : ''}
            </Text>
          </View>
          <View style={styles.messageRow}>
            {item.type === 'synced' ? (
              <Text
                style={[styles.lastMessage, { color: colors.textSecondary, fontWeight: 'normal' }]}
                numberOfLines={1}
              >
                {item.phone}
              </Text>
            ) : renderLastMessage() || (
              <Text
                style={[
                  styles.lastMessage,
                  { color: (item.unreadCount || 0) > 0 ? colors.text : colors.textSecondary, fontWeight: (item.unreadCount || 0) > 0 ? '600' : 'normal' }
                ]}
                numberOfLines={1}
              >
                {item.lastMessage || item.phone}
              </Text>
            )}
            {(item.unreadCount || 0) > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {item.type === 'synced' && onAddContact && (
        <TouchableOpacity style={styles.addContactButton} onPress={() => onAddContact(item)}>
          <PlusIcon size={20} color="#3B82F6" />
        </TouchableOpacity>
      )}
    </View>
  );
};
