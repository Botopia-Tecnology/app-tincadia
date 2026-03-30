import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { PlusIcon } from '../icons/NavigationIcons';
import { ChatListItem as ChatListItemType } from '../../hooks/useChatList';
import { useTheme } from '../../contexts/ThemeContext';

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

  const renderLastMessage = () => {
    if (!item.lastMessage) return item.phone;

    if (item.lastMessage.includes('📞') || item.lastMessage.toLowerCase().includes('llamada')) {
      const isEnded = item.lastMessage.toLowerCase().match(/(finalizada|rechazada|perdida)/);
      const displayText = isEnded ? item.lastMessage.replace('📞', '☎️') : '📞 Llamada entrante';
      
      return (
        <Text style={{ color: isEnded ? '#EF4444' : '#3B82F6', fontWeight: '500' }}>
          {displayText}
        </Text>
      );
    }

    if ((item.lastMessage.startsWith('http') || item.lastMessage.startsWith('uploads/')) &&
        (item.lastMessage.includes('/chat-media/') || item.lastMessage.match(/\.(jpg|jpeg|png|gif|webp)/i))) {
      return '📷 Imagen';
    }

    if ((item.lastMessage.startsWith('http') || item.lastMessage.startsWith('uploads/')) &&
        item.lastMessage.match(/\.(m4a|mp3|wav|ogg|aac)/i)) {
      return '🎵 Audio';
    }

    return item.lastMessage;
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
                ? '✓ En Tincadia'
                : item.lastMessageTime
                  ? formatMessageTime(item.lastMessageTime)
                  : item.type === 'unknown' ? 'Desconocido' : ''}
            </Text>
          </View>
          <View style={styles.messageRow}>
            <Text
              style={[
                styles.lastMessage,
                { color: (item.unreadCount || 0) > 0 ? colors.text : colors.textSecondary, fontWeight: (item.unreadCount || 0) > 0 ? '600' : 'normal' }
              ]}
              numberOfLines={1}
            >
              {renderLastMessage()}
            </Text>
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
