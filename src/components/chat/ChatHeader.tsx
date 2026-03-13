import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { BackArrowIcon, VideoCallIcon } from '../icons/NavigationIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';

interface ChatHeaderProps {
  onBack: () => void;
  onProfilePress: () => void;
  onCallPress: () => void;
  displayName: string;
  avatarUrl?: string;
  subTitle?: string;
  colors: any;
}

export const ChatHeader = ({ onBack, onProfilePress, onCallPress, displayName, avatarUrl, subTitle, colors }: ChatHeaderProps) => {
  return (
    <View style={[chatViewStyles.header, {
      backgroundColor: colors.card,
      borderBottomColor: colors.border,
    }]}>
      <TouchableOpacity onPress={onBack} style={chatViewStyles.backBtn}>
        <BackArrowIcon size={24} color={colors.icon} />
      </TouchableOpacity>

      <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={onProfilePress}>
        <View style={chatViewStyles.avatarSmall}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
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
        <VideoCallIcon size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};
