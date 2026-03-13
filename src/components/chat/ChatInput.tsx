import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, PanResponder, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MagicPencilIcon } from '../icons/ActionIcons';
import { MicrophoneIcon, SendIcon, PlusIcon } from '../icons/NavigationIcons';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';

const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

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
  correctionOpacity?: Animated.Value;
  replyMessage?: any;
  setReplyMessage?: (msg: any) => void;
  inputAreaHeight?: number;
  setInputAreaHeight?: (h: number) => void;
  colors?: any;
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
  correctionOpacity = new Animated.Value(0),
  replyMessage = null,
  setReplyMessage = () => {},
  inputAreaHeight = 48,
  setInputAreaHeight = () => {},
  colors = { card: '#FFF', border: '#EEE', text: '#000', textSecondary: '#666', textMuted: '#999', inputBg: '#F3F4F6', icon: '#666' },
  isDark = false
}: ChatInputProps) => {
  const MIN_INPUT_HEIGHT = 48;
  const MAX_INPUT_HEIGHT = 220;
  
  const inputAreaHeightRef = useRef(inputAreaHeight);
  const dragStartHeight = useRef(inputAreaHeight);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartHeight.current = inputAreaHeightRef.current;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const newHeight = dragStartHeight.current - gestureState.dy;
        const clamped = Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, newHeight));
        setInputAreaHeight(clamped);
        inputAreaHeightRef.current = clamped;
      },
    })
  ).current;

  // Sync ref
  inputAreaHeightRef.current = inputAreaHeight;

  return (
    <View style={[chatViewStyles.inputContainer, {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
    }]}>
      {/* Drag Handle */}
      <View {...panResponder.panHandlers} style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 6, marginBottom: 2 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? '#555' : '#D1D5DB' }} />
      </View>

      {/* Reply Preview */}
      {replyMessage && (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: 8, borderLeftWidth: 4, borderLeftColor: '#4F46E5', marginBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#4F46E5', fontWeight: 'bold', fontSize: 12 }}>Respondiendo...</Text>
            <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 12 }}>{replyMessage.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyMessage(null)}><Ionicons name="close-circle" size={20} color={colors.textMuted} /></TouchableOpacity>
        </View>
      )}

      <View style={chatViewStyles.inputRow}>
        <View style={[chatViewStyles.inputWrapper, { backgroundColor: isDark ? colors.inputBg : '#F3F4F6' }]}>
          <AnimatedGradient
            colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 105, 180, 0.3)', 'rgba(0, 191, 255, 0.3)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, { opacity: correctionOpacity }]}
          />
          <TextInput
            style={[chatViewStyles.textInput, { color: colors.text, height: inputAreaHeight }]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textMuted}
            multiline
            value={messageText}
            onChangeText={setMessageText}
          />
          <TouchableOpacity style={[chatViewStyles.pencilButton, { opacity: isCorrecting ? 0.5 : 1 }]} onPress={onCorrection} disabled={isCorrecting}>
            <MagicPencilIcon size={24} />
          </TouchableOpacity>
        </View>

        <View style={chatViewStyles.actionsRow}>
          <View style={chatViewStyles.leftActions}>
            <TouchableOpacity style={[chatViewStyles.mediaButton, { backgroundColor: isDark ? colors.inputBg : '#F3F4F6' }]} onPress={onMediaPick}>
              <PlusIcon size={24} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={[chatViewStyles.mediaButton, { backgroundColor: isDark ? colors.inputBg : '#F3F4F6' }]} onPress={onVideoTranslatorPress}>
              <Ionicons name="videocam" size={22} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity style={[chatViewStyles.mediaButton, { backgroundColor: isSpeaking ? (isDark ? '#4F46E5' : '#EEF2FF') : (isDark ? colors.inputBg : '#F3F4F6') }]} onPress={onTextToSpeech}>
              <Ionicons name={isSpeaking ? 'volume-high' : 'volume-medium-outline'} size={22} color={isSpeaking ? '#4F46E5' : colors.icon} />
            </TouchableOpacity>
          </View>

          {messageText.trim() ? (
            <TouchableOpacity style={chatViewStyles.sendButton} onPress={onSend}>
              <SendIcon size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[chatViewStyles.micButton, { backgroundColor: isDark ? colors.inputBg : '#F3F4F6' }]} onPress={onAudioRecorderMode}>
              <MicrophoneIcon size={24} color={colors.icon} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};
