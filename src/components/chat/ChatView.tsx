/**
 * ChatView Component - Refactored (Final)
 * 
 * Container for the chat interface, orchestrating sub-components and useChat hook.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Animated, Easing, Keyboard, Vibration } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { mediaService } from '../../services/media.service';
import { chatService } from '../../services/chat.service';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';

// Components
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AudioRecorder } from './AudioRecorder';
import { StreamingLSCRecorder } from './StreamingLSCRecorder';
import { AddContactModal } from '../AddContactModal';
import { ContactProfileScreen } from './ContactProfileScreen';

interface ChatViewProps {
  conversationId: string;
  userId: string;
  otherUserName: string;
  otherUserPhone?: string;
  otherUserId: string;
  isUnknown?: boolean;
  isGroup?: boolean;
  otherUserAvatar?: string;
  onBack: () => void;
  onAddContact?: () => void;
  contactId?: string;
  alias?: string;
  customFirstName?: string;
  customLastName?: string;
  groupDescription?: string;
  onContactUpdate?: (contact: any) => void;
  onNavigateCall: (roomName: string, username: string, conversationId: string, userId: string) => void;
  currentUser?: any;
}

export function ChatView(props: ChatViewProps) {
  const { 
    conversationId, userId, otherUserName, otherUserId, 
    onBack, onNavigateCall, currentUser, otherUserPhone, isUnknown, otherUserAvatar,
    onContactUpdate, contactId, alias, customFirstName, customLastName
  } = props;
  
  const { colors, isDark } = useTheme();
  
  // Chat Logic Hook
  const { 
    messages, sendMessage, markMessagesAsRead
  } = useChat(conversationId, userId);

  // UI State
  const [messageText, setMessageText] = useState('');
  const [replyMessage, setReplyMessage] = useState<any>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showVideoTranslator, setShowVideoTranslator] = useState(false);
  const [uploadingMessages, setUploadingMessages] = useState<any[]>([]);
  const [inputAreaHeight, setInputAreaHeight] = useState(48);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  
  // Animations
  const correctionOpacity = useRef(new Animated.Value(0)).current;
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  useEffect(() => {
    markMessagesAsRead();
  }, [conversationId, markMessagesAsRead]);

  // Handlers
  const handleSend = async () => {
    if (!messageText.trim()) return;
    const textToSend = messageText;
    const metadata = replyMessage ? {
      replyToId: replyMessage.id,
      replyToContent: replyMessage.content,
      replyToSender: replyMessage.senderId === userId ? 'Tú' : otherUserName
    } : undefined;

    setMessageText('');
    setReplyMessage(null);
    setInputAreaHeight(48);
    Keyboard.dismiss();

    try {
      await sendMessage(textToSend, 'text', metadata);
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const handleCorrection = async () => {
    if (!messageText.trim() || isCorrecting) return;
    setIsCorrecting(true);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(correctionOpacity, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(correctionOpacity, { toValue: 0, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      ])
    ).start();

    try {
      const { correctedText } = await chatService.correctMessage(messageText);
      setMessageText(correctedText);
      Vibration.vibrate(50);
    } catch (err) {
      console.error('Correction error:', err);
    } finally {
      setIsCorrecting(false);
      correctionOpacity.stopAnimation();
      correctionOpacity.setValue(0);
    }
  };

  const handleMediaPick = async () => {
    try {
      const asset = await mediaService.pickMedia();
      if (!asset) return;

      const tempId = `upload-${Date.now()}`;
      setUploadingMessages(prev => [{
        id: tempId,
        content: '',
        localUri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image',
        status: 'uploading',
        createdAt: new Date().toISOString(),
        senderId: userId
      }, ...prev]);

      const result = await mediaService.uploadMedia(asset);
      await sendMessage(result.publicId, asset.type === 'video' ? 'video' : 'image', { publicId: result.publicId });
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
    } catch (err) {
      Alert.alert('Error', 'Error al subir archivo');
      setUploadingMessages([]);
    }
  };

  const handleAudioSend = async (uri: string, duration: number) => {
    try {
      const audioAsset = { uri, type: 'audio' as const, fileName: `audio_${Date.now()}.m4a` };
      const result = await mediaService.uploadMedia(audioAsset);
      await sendMessage(result.publicId, 'audio', { publicId: result.publicId, duration });
      setIsRecordingMode(false);
    } catch (err) {
      Alert.alert('Error', 'Error al enviar audio');
    }
  };

  const handleCall = () => {
    const roomName = `conv_${conversationId}`;
    const username = currentUser?.first_name || 'Usuario';
    onNavigateCall(roomName, username, conversationId, userId);
  };

  if (showProfile) {
    return (
      <ContactProfileScreen
        userId={userId}
        otherUserId={otherUserId}
        otherUserPhone={otherUserPhone}
        contactId={contactId}
        isContact={!isUnknown}
        displayName={otherUserName}
        alias={alias}
        customFirstName={customFirstName}
        customLastName={customLastName}
        avatarUrl={otherUserAvatar}
        conversationId={conversationId}
        onBack={() => setShowProfile(false)}
        onDeleteContact={() => {
          setShowProfile(false);
          onBack();
        }}
        onContactUpdated={(contact: any) => {
          if (onContactUpdate) onContactUpdate(contact);
        }}
        onContactAdded={(contact: any) => {
          if (onContactUpdate) onContactUpdate(contact);
        }}
      />
    );
  }

  return (
    <View style={[chatViewStyles.container, { backgroundColor: colors.background }]}>
      <ChatHeader
        onBack={onBack}
        onProfilePress={() => setShowProfile(true)}
        onCallPress={handleCall}
        displayName={otherUserName}
        avatarUrl={otherUserAvatar}
        subTitle={otherUserPhone}
        colors={colors}
      />

      <MessageList
        messages={messages}
        uploadingMessages={uploadingMessages}
        userId={userId}
        onLongPress={() => {}} 
        onSwipeReply={(msg) => setReplyMessage(msg)}
        onJoinCall={handleCall}
        colors={colors}
        isDark={isDark}
        swipeableRefs={swipeableRefs}
      />

      {isRecordingMode ? (
        <AudioRecorder onSend={handleAudioSend} onCancel={() => setIsRecordingMode(false)} />
      ) : (
        <ChatInput
          messageText={messageText}
          setMessageText={setMessageText}
          onSend={handleSend}
          onMediaPick={handleMediaPick}
          onAudioRecorderMode={() => setIsRecordingMode(true)}
          onVideoTranslatorPress={() => setShowVideoTranslator(true)}
          onTextToSpeech={() => {}} // Disabled as expo-speech is not installed
          onCorrection={handleCorrection}
          isCorrecting={isCorrecting}
          isSpeaking={false}
          correctionOpacity={correctionOpacity}
          replyMessage={replyMessage}
          setReplyMessage={setReplyMessage}
          inputAreaHeight={inputAreaHeight}
          setInputAreaHeight={setInputAreaHeight}
          colors={colors}
          isDark={isDark}
        />
      )}

      {showVideoTranslator && (
        <StreamingLSCRecorder
          visible={showVideoTranslator}
          onClose={() => setShowVideoTranslator(false)}
          onTranslationReceived={(text) => {
            setMessageText(prev => prev ? `${prev} ${text}` : text);
          }}
        />
      )}

      {isUnknown && (
        <AddContactModal
          visible={showAddContactModal}
          onClose={() => setShowAddContactModal(false)}
          onContactAdded={(contact) => {
            setShowAddContactModal(false);
            if (onContactUpdate) onContactUpdate(contact);
          }}
          userId={userId}
          initialPhone={otherUserPhone || ''}
        />
      )}
    </View>
  );
}
