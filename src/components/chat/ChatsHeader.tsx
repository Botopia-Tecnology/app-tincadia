import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { NotificationIcon, SearchIcon } from '../icons/NavigationIcons';
import { useTheme } from '../../contexts/ThemeContext';

interface ChatsHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  unreadCount: number;
  onNotificationsPress: () => void;
  styles: Record<string, ViewStyle | TextStyle | ImageStyle>;
}

export const ChatsHeader = ({ searchQuery, onSearchChange, unreadCount, onNotificationsPress, styles }: ChatsHeaderProps) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.headerTop}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.iconButton} onPress={onNotificationsPress}>
            <NotificationIcon size={24} color={colors.icon} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.inputBg }]}>
        <SearchIcon size={20} color={colors.iconSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar chats"
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
};
