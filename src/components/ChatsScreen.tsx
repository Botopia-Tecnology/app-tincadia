import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { chatsScreenStyles as styles } from '../styles/ChatsScreen.styles';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount?: number;
  avatar: any;
  isRead?: boolean;
  messageType?: 'text' | 'voice' | 'photo';
}

function ChatItem({ chat }: { chat: Chat }) {
  const getMessageIcon = () => {
    if (chat.messageType === 'voice') {
      return '🎤';
    }
    if (chat.messageType === 'photo') {
      return '📷';
    }
    return null;
  };

  const getReadIcon = () => {
    if (chat.isRead) {
      return '✓✓';
    }
    return '✓';
  };

  return (
    <TouchableOpacity style={styles.chatItem}>
      <Image source={chat.avatar} style={styles.avatar} />
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{chat.name}</Text>
          <Text style={styles.timestamp}>{chat.timestamp}</Text>
        </View>
        <View style={styles.messageRow}>
          {chat.isRead && chat.messageType === 'text' && (
            <Text style={styles.readIcon}>{getReadIcon()}</Text>
          )}
          {getMessageIcon() && (
            <Text style={styles.messageIcon}>{getMessageIcon()}</Text>
          )}
          <Text style={styles.lastMessage} numberOfLines={1}>
            {chat.lastMessage}
          </Text>
          {chat.unreadCount && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{chat.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function ChatsScreen() {
  const { t } = useTranslation();

  const chatsData = (t('chats.list') as unknown as Chat[]).map((item) => ({
    ...item,
    avatar: require('../../assets/icon.png'),
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chats.title')}</Text>
        <TouchableOpacity style={styles.videoButton}>
          <Text style={styles.videoIcon}>📹</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de chats */}
      <FlatList
        data={chatsData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatItem chat={item} />}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>💬</Text>
          <Text style={[styles.navLabel, styles.navLabelActive]}>
            {t('navigation.chats')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📚</Text>
          <Text style={styles.navLabel}>{t('navigation.courses')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>💡</Text>
          <Text style={styles.navLabel}>{t('navigation.sos')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>{t('navigation.profile')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🤝</Text>
          <Text style={styles.navLabel}>{t('navigation.more')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
