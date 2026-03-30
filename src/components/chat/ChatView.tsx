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
import { Audio } from 'expo-av';
import { API_URL } from '../../config/api.config';

// Components
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { AudioRecorder } from './AudioRecorder';
import { StreamingLSCRecorder } from './StreamingLSCRecorder';
import { AddContactModal } from '../AddContactModal';
import { ContactProfileScreen } from './ContactProfileScreen';
import { useSubscription } from '../../hooks/useSubscription';
import { UpgradeModal } from '../UpgradeModal';
import { Contact } from '../../services/contact.service';
import { Message } from '../../hooks/useChat';
import { User } from '../../types/auth.types';
import { MessageActionSheet } from './MessageActionSheet';

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
  onContactUpdate?: (contact: Contact) => void;
  onNavigateCall: (roomName: string, username: string, conversationId: string, userId: string) => void;
  currentUser?: User | null;
}

interface UploadingMessage {
  id: string;
  content: string;
  localUri: string;
  type: 'image' | 'video';
  status: 'uploading';
  createdAt: string;
  senderId: string;
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
    messages, sendMessage, editMessage, markMessagesAsRead
  } = useChat(conversationId, userId, { 
    readReceiptsEnabled: currentUser?.readReceiptsEnabled ?? true 
  });

  // Limits Logic
  const {
    planTier,
    canUseCorrection, recordCorrectionUse,
    canUseTranscription, recordTranscriptionUse,
    canUseLSC, canUseTTS
  } = useSubscription(userId);

  // UI State
  const [messageText, setMessageText] = useState('');
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showVideoTranslator, setShowVideoTranslator] = useState(false);
  const [uploadingMessages, setUploadingMessages] = useState<UploadingMessage[]>([]);
  const [inputAreaHeight, setInputAreaHeight] = useState(48);
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsSound, setTtsSound] = useState<Audio.Sound | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<'transcription' | 'transcription_blocked' | 'lsc' | 'correction' | 'correction_blocked' | 'tts' | 'interpreter'>('correction');
  
  // Animations
  const correctionOpacity = useRef(new Animated.Value(0)).current;
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  useEffect(() => {
    markMessagesAsRead();
  }, [conversationId, markMessagesAsRead]);

  // Handlers
  const handleSend = async () => {
    if (!messageText.trim()) return;

    // Editing mode — update existing message
    if (editingMessage) {
      const newText = messageText.trim();
      setEditingMessage(null);
      setMessageText('');
      await editMessage(editingMessage.id, newText);
      return;
    }

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

    if (!canUseCorrection()) {
        setUpgradeFeature(planTier === 'gratis' ? 'correction_blocked' : 'correction');
        setShowUpgradeModal(true);
        return;
    }
    
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
      recordCorrectionUse();
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
      recordTranscriptionUse();
      setIsRecordingMode(false);
    } catch (err) {
      Alert.alert('Error', 'Error al enviar audio');
    }
  };

  const handleCall = async () => {
    const roomName = `conv_${conversationId}`;
    const username = currentUser?.firstName || 'Usuario';
    
    // Send a message of type 'call' to trigger notification for the other user
    // We don't await this to avoid delaying the UI navigation
    sendMessage('📞 Llamada iniciada', 'call', { roomName }).catch(err => {
      console.error('Failed to send call notification message:', err);
    });

    onNavigateCall(roomName, username, conversationId, userId);
  };

  // ── Message long-press actions ──────────────────────────────────────────
  const handleLongPress = (msg: Message) => {
    setActionMessage(msg);
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setMessageText(msg.content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setMessageText('');
  };

  const handleDeleteMessage = (msg: Message) => {
    Alert.alert(
      'Eliminar mensaje',
      '¿Eliminar este mensaje para todos?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatService.deleteMessage(msg.id, userId);
            } catch {
              Alert.alert('Error', 'No se pudo eliminar el mensaje');
            }
          },
        },
      ],
    );
  };

  const handleTextToSpeech = async () => {
    if (!messageText.trim()) return;

    if (!canUseTTS) {
        setUpgradeFeature('tts');
        setShowUpgradeModal(true);
        return;
    }

    // Stop if already speaking
    if (isSpeaking) {
      if (ttsSound) {
        await ttsSound.stopAsync();
        await ttsSound.unloadAsync();
        setTtsSound(null);
      }
      setIsSpeaking(false);
      return;
    }

    try {
      Vibration.vibrate(40);
      setIsSpeaking(true);

      const result = await fetch(`${API_URL}/model/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: messageText }),
      }).then(r => r.json());

      if (!result?.audioUrl) throw new Error('No audioUrl received');

      const { sound } = await Audio.Sound.createAsync({ uri: result.audioUrl });
      setTtsSound(sound);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          sound.unloadAsync();
          setTtsSound(null);
        }
      });
      await sound.playAsync();
    } catch (e) {
      console.error('TTS error:', e);
      setIsSpeaking(false);
    }
  };

  const handleAudioRecorderMode = () => {
    if (!canUseTranscription()) {
        setUpgradeFeature(planTier === 'gratis' ? 'transcription_blocked' : 'transcription');
        setShowUpgradeModal(true);
        return;
    }
    setIsRecordingMode(true);
  };

  const handleVideoTranslatorPress = () => {
    if (!canUseLSC) {
        setUpgradeFeature('lsc');
        setShowUpgradeModal(true);
        return;
    }
    setShowVideoTranslator(true);
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
        onContactUpdated={(contact: Contact) => {
          if (onContactUpdate) onContactUpdate(contact);
        }}
        onContactAdded={(contact: Contact) => {
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
        isUnknown={isUnknown}
        colors={colors}
      />

      <MessageList
        messages={messages}
        uploadingMessages={uploadingMessages}
        userId={userId}
        onLongPress={handleLongPress}
        onSwipeReply={(msg) => setReplyMessage(msg)}
        onJoinCall={handleCall}
        colors={colors}
        isDark={isDark}
        swipeableRefs={swipeableRefs}
        readReceiptsEnabled={currentUser?.readReceiptsEnabled ?? true}
      />

      {isRecordingMode ? (
        <AudioRecorder onSend={handleAudioSend} onCancel={() => setIsRecordingMode(false)} />
      ) : (
        <ChatInput
          messageText={messageText}
          setMessageText={setMessageText}
          onSend={handleSend}
          onMediaPick={handleMediaPick}
          onAudioRecorderMode={handleAudioRecorderMode}
          onVideoTranslatorPress={handleVideoTranslatorPress}
          onTextToSpeech={handleTextToSpeech}
          onCorrection={handleCorrection}
          isCorrecting={isCorrecting}
          isSpeaking={isSpeaking}
          correctionOpacity={correctionOpacity}
          replyMessage={replyMessage}
          setReplyMessage={setReplyMessage}
          editingMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
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
            if (contact && onContactUpdate) onContactUpdate(contact as Contact);
          }}
          userId={userId}
          initialPhone={otherUserPhone || ''}
        />
      )}

      <MessageActionSheet
        message={actionMessage}
        currentUserId={userId}
        onClose={() => setActionMessage(null)}
        onReply={(msg) => {
          setReplyMessage(msg);
          setActionMessage(null);
        }}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
      />

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
      />
    </View>
  );
}
