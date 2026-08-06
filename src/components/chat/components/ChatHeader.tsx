import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { BackArrowIcon, VideoCallIcon } from '../../icons/NavigationIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { chatViewStyles } from '../../../styles/ChatsScreen.styles';

import { API_URL } from '../../../config/api.config';

import { ThemeColors } from '../../../contexts/ThemeContext';

interface ChatHeaderProps {
  onBack: () => void;
  onProfilePress: () => void;
  onCallPress: () => void;
  displayName: string;
  avatarUrl?: string;
  subTitle?: string;
  isUnknown?: boolean;
  colors: ThemeColors;
  typingUsers?: string[];
}

export const ChatHeader = ({ onBack, onProfilePress, onCallPress, displayName, avatarUrl, subTitle, isUnknown, typingUsers }: ChatHeaderProps) => {
  const { colors, isDark } = useTheme();

  const [imageError, setImageError] = React.useState(false);

  const normalizeUrl = (url?: string) => {
    if (!url) return undefined;
    const trimmed = String(url).trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') return undefined;
    if (trimmed.startsWith('http')) return trimmed;
    return `${API_URL}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  };

  const finalAvatarUrl = normalizeUrl(avatarUrl);
  const hasValidAvatar = !!finalAvatarUrl && !imageError;

  React.useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

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
          { overflow: 'hidden' },
          isUnknown && { backgroundColor: '#9CA3AF' }
        ]}>
          {hasValidAvatar ? (
            <Image
              source={{ uri: finalAvatarUrl }}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              onError={() => setImageError(true)}
            />
          ) : (
            <Text style={chatViewStyles.avatarSmallText}>{displayName ? displayName.charAt(0).toUpperCase() : '?'}</Text>
          )}
        </View>
        <View style={chatViewStyles.headerInfo}>
          <Text style={[chatViewStyles.chatName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {typingUsers && typingUsers.length > 0 ? (
            <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: '500' }}>
              {typingUsers.join(', ')} escribiendo...
            </Text>
          ) : (
            subTitle && <Text style={[chatViewStyles.lastMessage, { color: colors.textSecondary }]}>{subTitle}</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={{ padding: 8 }} onPress={onCallPress}>
        <VideoCallIcon size={24} isDark={isDark} />
      </TouchableOpacity>
    </View>
  );
};
