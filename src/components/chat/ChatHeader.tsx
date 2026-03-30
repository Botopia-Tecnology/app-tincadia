import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { BackArrowIcon, VideoCallIcon } from '../icons/NavigationIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';

import { API_URL } from '../../config/api.config';

import { ThemeColors } from '../../contexts/ThemeContext';

interface ChatHeaderProps {
  onBack: () => void;
  onProfilePress: () => void;
  onCallPress: () => void;
  displayName: string;
  avatarUrl?: string;
  subTitle?: string;
  isUnknown?: boolean;
  colors: ThemeColors;
}

export const ChatHeader = ({ onBack, onProfilePress, onCallPress, displayName, avatarUrl, subTitle, isUnknown }: ChatHeaderProps) => {
  const { colors, isDark } = useTheme();

  const normalizeUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const finalAvatarUrl = normalizeUrl(avatarUrl);

  return (
    <View style={[chatViewStyles.header, {
      backgroundColor: colors.card,
      borderBottomColor: colors.border,
    }]}>
      <TouchableOpacity onPress={onBack} style={chatViewStyles.backBtn}>
        <BackArrowIcon size={24} color={colors.icon} />
      </TouchableOpacity>

      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={onProfilePress}>
        <View style={[
          chatViewStyles.avatarSmall,
          isUnknown && { backgroundColor: '#9CA3AF' },
          finalAvatarUrl ? { backgroundColor: 'transparent' } : {}
        ]}>
          {finalAvatarUrl ? (
            <Image source={{ uri: finalAvatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
          ) : (
            <Text style={chatViewStyles.avatarSmallText}>{displayName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={chatViewStyles.headerInfo}>
          <Text style={[chatViewStyles.chatName, { color: colors.text }]}>{displayName}</Text>
          {subTitle ? (
            <Text style={[chatViewStyles.lastMessage, { color: colors.textSecondary }]}>{subTitle}</Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={{ padding: 8 }} onPress={onCallPress}>
        <VideoCallIcon size={24} isDark={isDark} />
      </TouchableOpacity>
    </View>
  );
};
