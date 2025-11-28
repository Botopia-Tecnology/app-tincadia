import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';

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

// Datos hardcodeados de chats
const chatsData: Chat[] = [
  {
    id: '1',
    name: 'Arjun Das Mygate',
    lastMessage: 'Hey i got to know your are amid a design task, ATB for same.',
    timestamp: '12:35 PM',
    unreadCount: 10,
    avatar: require('../../assets/icon.png'),
    isRead: false,
    messageType: 'text',
  },
  {
    id: '2',
    name: 'Antony Das',
    lastMessage: 'What kind of strategy is better?',
    timestamp: '11:55 AM',
    avatar: require('../../assets/icon.png'),
    isRead: true,
    messageType: 'text',
  },
  {
    id: '3',
    name: 'Elisa das Zoho',
    lastMessage: '0:14',
    timestamp: 'Yesterday',
    avatar: require('../../assets/icon.png'),
    isRead: false,
    messageType: 'voice',
  },
  {
    id: '4',
    name: 'Harold Das',
    lastMessage: 'Bro, I have a good idea!',
    timestamp: 'Yesterday',
    avatar: require('../../assets/icon.png'),
    isRead: true,
    messageType: 'text',
  },
  {
    id: '5',
    name: 'Revathi Freshworks',
    lastMessage: 'Photo',
    timestamp: 'Yesterday',
    avatar: require('../../assets/icon.png'),
    isRead: false,
    messageType: 'photo',
  },
  {
    id: '6',
    name: 'Kishore Rocketlane',
    lastMessage: 'Actually I wanted to check with you about your online business plan on our...',
    timestamp: 'Yesterday',
    avatar: require('../../assets/icon.png'),
    isRead: false,
    messageType: 'text',
  },
  {
    id: '7',
    name: 'Herold Das',
    lastMessage: 'Welcome, to make design process faster, look at Pixsellz.',
    timestamp: 'Wednesday',
    avatar: require('../../assets/icon.png'),
    isRead: true,
    messageType: 'text',
  },
  {
    id: '8',
    name: 'LEO Das',
    lastMessage: 'Ok, have a good trip!',
    timestamp: 'Wednesday',
    avatar: require('../../assets/icon.png'),
    isRead: true,
    messageType: 'text',
  },
];

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  videoButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoIcon: {
    fontSize: 24,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    color: '#999999',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readIcon: {
    fontSize: 14,
    color: '#4CAF50',
    marginRight: 4,
  },
  messageIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
  },
  unreadBadge: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  navItemActive: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    color: '#999999',
  },
  navLabelActive: {
    color: '#000000',
    fontWeight: '600',
  },
});

