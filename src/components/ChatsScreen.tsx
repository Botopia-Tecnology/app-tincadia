import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { chatsScreenStyles as styles } from '../styles/ChatsScreen.styles';
import {
  BackArrowIcon,
  VideoCallIcon,
  ChatIcon,
  CoursesIcon,
  SOSIcon,
  ProfileIcon,
  HandshakeIcon,
  VoiceIcon,
  PhotoIcon,
  CheckIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';

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
            <View style={styles.readIcon}>
              <CheckIcon size={12} color="#4CAF50" />
              <View style={{ marginLeft: -4 }}>
                <CheckIcon size={12} color="#4CAF50" />
              </View>
            </View>
          )}
          {chat.messageType === 'voice' && (
            <View style={styles.messageIcon}>
              <VoiceIcon size={16} color="#666666" />
            </View>
          )}
          {chat.messageType === 'photo' && (
            <View style={styles.messageIcon}>
              <PhotoIcon size={16} color="#666666" />
            </View>
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

export function ChatsScreen({ onNavigate }: { onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void }) {
  const { t } = useTranslation();

  const chatsData = (t('chats.list') as unknown as Chat[]).map((item) => ({
    ...item,
    avatar: require('../../assets/icon.png'),
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton}>
          <BackArrowIcon size={20} color="#000000" />
        </TouchableOpacity>
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

      {/* Lista de chats */}
      <FlatList
        data={chatsData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatItem chat={item} />}
        contentContainerStyle={styles.listContent}
        style={styles.list}
      />

      <BottomNavigation currentScreen="chats" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}
