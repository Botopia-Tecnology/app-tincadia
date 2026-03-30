import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Animated as RNAnimated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MagicPencilIcon } from '../icons/ActionIcons';
import { MicrophoneIcon, SendIcon, PlusIcon } from '../icons/NavigationIcons';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { Message } from '../../hooks/useChat';
import { ThemeColors } from '../../contexts/ThemeContext';

const AnimatedGradient = RNAnimated.createAnimatedComponent(LinearGradient);

interface ChatInputProps {
  messageText: string;
  setMessageText: (text: string) => void;
  onSend: () => void;
  onMediaPick?: () => void;
  onAudioRecorderMode?: () => void;
  onVideoTranslatorPress?: () => void;
  onTextToSpeech?: () => void;
  onCorrection?: () => void;
  isCorrecting?: boolean;
  isSpeaking?: boolean;
  correctionOpacity?: RNAnimated.Value;
  replyMessage?: Message | null;
  setReplyMessage?: (msg: Message | null) => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
  inputAreaHeight?: number;
  setInputAreaHeight?: (h: number) => void;
  colors?: ThemeColors;
  isDark?: boolean;
}

export const ChatInput = ({
  messageText = '',
  setMessageText = () => {},
  onSend = () => {},
  onMediaPick = () => {},
  onAudioRecorderMode = () => {},
  onVideoTranslatorPress = () => {},
  onTextToSpeech = () => {},
  onCorrection = () => {},
  isCorrecting = false,
  isSpeaking = false,
  correctionOpacity = new RNAnimated.Value(0),
  replyMessage = null,
  setReplyMessage = () => {},
  editingMessage = null,
  onCancelEdit = () => {},
  inputAreaHeight = 48,
  setInputAreaHeight = () => {},
  colors,
  isDark: isDarkProp
}: ChatInputProps) => {
  const { colors: themeColors, isDark: themeIsDark } = useTheme();
  const finalColors = colors || themeColors;
  const isDark = isDarkProp ?? themeIsDark;

  const MIN_INPUT_HEIGHT = 48;
  const MAX_INPUT_HEIGHT = 400; // Expanded to 400px
  
  const height = useSharedValue(inputAreaHeight);
  const dragStartHeight = useRef(inputAreaHeight);

  // Sync shared value with prop
  React.useEffect(() => {
    height.value = inputAreaHeight;
  }, [inputAreaHeight]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      dragStartHeight.current = height.value;
    })
    .onUpdate((event) => {
      const newHeight = dragStartHeight.current - event.translationY;
      height.value = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, newHeight));
    })
    .onFinalize(() => {
      runOnJS(setInputAreaHeight)(height.value);
    });

  const animatedInputStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <View style={[chatViewStyles.inputContainer, {
      backgroundColor: finalColors.card,
      borderTopColor: finalColors.border,
    }]}>
      {/* Drag Handle */}
      <GestureDetector gesture={panGesture}>
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 16, width: '100%' }}>
          <View style={{ width: 40, height: 5, borderRadius: 2.5, backgroundColor: isDark ? '#666' : '#D1D5DB' }} />
        </View>
      </GestureDetector>

      {/* Editing Banner */}
      {editingMessage && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', padding: 8, borderLeftWidth: 4, borderLeftColor: '#6366F1', marginBottom: 4 }}>
          <Ionicons name="pencil" size={14} color="#6366F1" style={{ marginRight: 6 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#6366F1', fontWeight: 'bold', fontSize: 12 }}>Editando mensaje</Text>
            <Text numberOfLines={1} style={{ color: finalColors.textSecondary, fontSize: 12 }}>{editingMessage.content}</Text>
          </View>
          <TouchableOpacity onPress={onCancelEdit}><Ionicons name="close-circle" size={20} color={finalColors.textMuted} /></TouchableOpacity>
        </View>
      )}

      {/* Reply Preview */}
      {replyMessage && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: 8, borderLeftWidth: 4, borderLeftColor: '#4F46E5', marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#4F46E5', fontWeight: 'bold', fontSize: 12 }}>Respondiendo...</Text>
            <Text numberOfLines={1} style={{ color: finalColors.textSecondary, fontSize: 12 }}>{replyMessage.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyMessage(null)}><Ionicons name="close-circle" size={20} color={finalColors.textMuted} /></TouchableOpacity>
        </View>
      )}

      <View style={chatViewStyles.inputRow}>
        <Animated.View style={[chatViewStyles.inputWrapper, { backgroundColor: isDark ? finalColors.inputBg : '#F3F4F6' }, animatedInputStyle]}>
          <AnimatedGradient
            colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 105, 180, 0.3)', 'rgba(0, 191, 255, 0.3)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, { opacity: correctionOpacity }]}
          />
          <TextInput
            style={[chatViewStyles.textInput, { color: finalColors.text, height: '100%' }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={finalColors.textMuted}
            multiline
            value={messageText}
            onChangeText={setMessageText}
          />
          <TouchableOpacity style={[chatViewStyles.pencilButton, { opacity: isCorrecting ? 0.5 : 1 }]} onPress={onCorrection} disabled={isCorrecting}>
            <MagicPencilIcon size={24} />
          </TouchableOpacity>
        </Animated.View>

        <View style={chatViewStyles.actionsRow}>
          <View style={chatViewStyles.leftActions}>
            <TouchableOpacity style={[chatViewStyles.mediaButton, { backgroundColor: isDark ? finalColors.inputBg : '#F3F4F6' }]} onPress={onMediaPick}>
              <PlusIcon size={24} color={finalColors.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={[chatViewStyles.mediaButton, { backgroundColor: isDark ? finalColors.inputBg : '#F3F4F6' }]} onPress={onVideoTranslatorPress}>
              <Ionicons name="videocam" size={22} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[chatViewStyles.mediaButton, { backgroundColor: isSpeaking ? (isDark ? '#4F46E5' : '#EEF2FF') : (isDark ? finalColors.inputBg : '#F3F4F6') }]} 
              onPress={onTextToSpeech}
              disabled={isSpeaking}
            >
              <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={22} color={isSpeaking ? '#4F46E5' : finalColors.icon} />
            </TouchableOpacity>
          </View>

          {messageText.trim() ? (
            <TouchableOpacity style={chatViewStyles.sendButton} onPress={onSend}>
              <SendIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[chatViewStyles.micButton, { backgroundColor: isDark ? finalColors.inputBg : '#F3F4F6' }]} onPress={onAudioRecorderMode}>
              <MicrophoneIcon size={24} color={finalColors.icon} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
