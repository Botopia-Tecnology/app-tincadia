/**
 * ChatView Component - Refactored (Final)
 * 
 * Container for the chat interface, orchestrating sub-components and useChat hook.
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, Alert, Animated, Easing, Keyboard, Vibration, DeviceEventEmitter } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../contexts/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { mediaService } from '../../services/media.service';
import { chatService } from '../../services/chat.service';
import { callKeepService } from '../../services/callkeep.service';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { Audio } from 'expo-av';
import { API_URL } from '../../config/api.config';

// Components
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';
import { AudioRecorder } from './recorders/AudioRecorder';
import { StreamingLSCRecorder } from './recorders/StreamingLSCRecorder';
import { VideoNoteRecorder } from './recorders/VideoNoteRecorder';
import { AddContactModal } from '../AddContactModal';
import { AttachmentMenu } from './components/AttachmentMenu';
import { ContactProfileScreen } from './ContactProfileScreen';
import { GroupProfileView } from './GroupProfileView';
import { useSubscription } from '../../hooks/useSubscription';
import { UpgradeModal } from '../UpgradeModal';
import { useProductTourContext } from '../../contexts/ProductTourContext';
import { Contact } from '../../services/contact.service';
import { Message } from '../../hooks/useChat';
import { User } from '../../types/auth.types';
import { MessageActionSheet } from './components/MessageActionSheet';
import { APP_TIERS } from '../../config/revenuecat.config';
import { NavigateFunction } from '../../types/navigation.types';
import { CallState, HANDOFF_ACTIVE_CALL_EVENT } from '../../lib/callState';

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
  onGroupUpdate?: (updates: { title?: string; description?: string; imageUrl?: string }) => void;
  onContactUpdate?: (contact: Contact) => void;
  onNavigateCall: (
    roomName: string,
    username: string,
    conversationId: string,
    userId: string,
    callSessionId?: string,
    options?: { suppressRinging?: boolean },
  ) => void;
  onNavigate: NavigateFunction;
  currentUser?: User | null;
}

interface UploadingMessage {
  id: string;
  content: string;
  localUri: string;
  type: 'image' | 'video' | 'document' | 'audio';
  status: 'uploading' | 'failed';
  createdAt: string;
  senderId: string;
  metadata?: { duration?: number; isVideoNote?: boolean };
}

export function ChatView(props: ChatViewProps) {
  const {
    conversationId, userId, otherUserName, otherUserId,
    onBack, onNavigateCall, currentUser, otherUserPhone, isUnknown, otherUserAvatar,
    onContactUpdate, contactId, alias, customFirstName, customLastName,
    isGroup, groupDescription, onGroupUpdate, onNavigate
  } = props;

  const { colors, isDark } = useTheme();

  // Chat Logic Hook
  const {
    messages, sendMessage, editMessage, deleteMessage, markMessagesAsRead
  } = useChat(conversationId, userId, {
    readReceiptsEnabled: currentUser?.readReceiptsEnabled ?? true,
    isGroup,
  });

  // Limits Logic
  const {
    planTier,
    canUseCorrection, recordCorrectionUse,
    correctionLimit, correctionUsesToday,
    canUseLSC, canUseTTS
  } = useSubscription(userId);

  // Typing Indicator Hook
  const { typingUsers, setIsTyping } = useTypingIndicator(
    conversationId,
    userId,
    currentUser?.firstName || 'Usuario'
  );

  // UI State
  const [messageText, setMessageText] = useState('');
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showVideoTranslator, setShowVideoTranslator] = useState(false);
  const [uploadingMessages, setUploadingMessages] = useState<UploadingMessage[]>([]);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showVideoNoteRecorder, setShowVideoNoteRecorder] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(48);

  const { startTour } = useProductTourContext();

  // Product Tour for Chat
  useEffect(() => {
    // Un pequeño delay para asegurar que los componentes de la interfaz estén montados y medibles
    const timer = setTimeout(() => {
      startTour([
        {
          targetKey: 'chat_input_text',
          title: 'Escribe tu mensaje',
          description: 'Aquí puedes escribir mensajes de texto normales.'
        },
        {
          targetKey: 'chat_magic_pencil',
          title: 'Lápiz Mágico con IA',
          description: '¿Dudas con la ortografía? Presiona este botón y la inteligencia artificial corregirá tu texto automáticamente.'
        },
        {
          targetKey: 'chat_video_call',
          title: 'Modelo de Señas a texto',
          description: 'Traduce las señas una a una a texto para agilizar tiempo.'
        },
        {
          targetKey: 'chat_mic',
          title: 'Notas de Voz',
          description: 'Mantén presionado para enviar una nota de voz.'
        }
      ], 'chat_screen_tour_v1');
    }, 800);

    return () => clearTimeout(timer);
  }, [startTour]);

  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [upgradeFeature, setUpgradeFeature] = useState<'transcription' | 'transcription_blocked' | 'lsc' | 'correction' | 'correction_blocked' | 'tts' | 'interpreter'>('correction');

  // Animations
  const correctionOpacity = useRef(new Animated.Value(0)).current;
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const retryingUploads = useRef<Set<string>>(new Set());

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
    const myDisplayName = currentUser?.firstName || 'Tú';
    let formattedReplyContent = replyMessage?.content;
    if (replyMessage) {
       if (replyMessage.type === 'audio') {
           const duration = replyMessage.metadata?.duration;
           formattedReplyContent = duration ? `🎵 Audio (${Math.floor(duration/60)}:${Math.floor(duration%60).toString().padStart(2, '0')})` : '🎵 Audio';
       } else if (replyMessage.type === 'image') {
           formattedReplyContent = '📷 Foto';
       } else if (replyMessage.type === 'video') {
           const duration = replyMessage.metadata?.duration;
           formattedReplyContent = duration ? `🎥 Video (${Math.floor(duration/60)}:${Math.floor(duration%60).toString().padStart(2, '0')})` : '🎥 Video';
       } else if (replyMessage.type === 'document') {
           formattedReplyContent = '📄 Documento';
       }
    }

    const metadata = replyMessage ? {
      replyToId: replyMessage.id,
      replyToContent: formattedReplyContent,
      replyToSender: replyMessage.senderId === userId
        ? myDisplayName
        : (isGroup ? replyMessage.senderName || otherUserName : otherUserName),
      replyToSenderId: replyMessage.senderId,
    } : undefined;

    setMessageText('');
    setReplyMessage(null);
    setInputAreaHeight(48);

    try {
      await sendMessage(textToSend, 'text', metadata);
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  const handleCorrection = async () => {
    if (!messageText.trim() || isCorrecting) return;

    if (!canUseCorrection()) {
      setUpgradeFeature(planTier === APP_TIERS.GRATIS ? 'correction_blocked' : 'correction');
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
      const { correctedText } = await chatService.correctMessage(messageText, currentUser?.id || '');
      setMessageText(correctedText);
      setIsTyping(correctedText.length > 0);
      recordCorrectionUse();
      Vibration.vibrate(50);
    } catch (err: any) {
      console.error('Correction error:', err);
      if (err?.message?.includes('LIMIT_EXCEEDED') || err?.status === 403) {
        setUpgradeFeature(planTier === APP_TIERS.GRATIS ? 'correction_blocked' : 'correction');
        setShowUpgradeModal(true);
      }
    } finally {
      setIsCorrecting(false);
      correctionOpacity.stopAnimation();
      correctionOpacity.setValue(0);
    }
  };

  const handleMediaPick = () => {
    setShowAttachmentMenu(true);
  };

  const retryUpload = async (failedMsg: UploadingMessage) => {
    // Guard against concurrent taps for the same message
    if (retryingUploads.current.has(failedMsg.id)) return;
    retryingUploads.current.add(failedMsg.id);

    // Reset status to uploading
    setUploadingMessages(prev => prev.map(m => m.id === failedMsg.id ? { ...m, status: 'uploading' as const } : m));

    try {
      const mediaAsset = {
        uri: failedMsg.localUri,
        type: failedMsg.type as 'image' | 'video' | 'audio' | 'document',
        fileName: `retry_${Date.now()}.${failedMsg.type === 'video' ? 'mp4' : failedMsg.type === 'audio' ? 'm4a' : 'jpg'}`,
        mimeType: failedMsg.type === 'video' ? 'video/mp4' : failedMsg.type === 'audio' ? 'audio/m4a' : undefined,
        duration: failedMsg.metadata?.duration,
      };

      const result = await mediaService.uploadMedia(mediaAsset);

      // Remove optimistic bubble before sending
      setUploadingMessages(prev => prev.filter(m => m.id !== failedMsg.id));

      await sendMessage(
        result.publicId,
        failedMsg.type,
        {
          publicId: result.publicId,
          url: result.url,
          duration: failedMsg.metadata?.duration,
          isVideoNote: failedMsg.metadata?.isVideoNote,
        },
        failedMsg.localUri
      );
    } catch (err) {
      console.error('Retry upload failed:', err);
      setUploadingMessages(prev => {
        if (prev.some(m => m.id === failedMsg.id)) {
          return prev.map(m => m.id === failedMsg.id ? { ...m, status: 'failed' as const } : m);
        }
        return [{ ...failedMsg, status: 'failed' as const }, ...prev];
      });
    } finally {
      retryingUploads.current.delete(failedMsg.id);
    }
  };

  const dismissFailedUpload = (msgId: string) => {
    retryingUploads.current.delete(msgId);
    setUploadingMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const processAsset = async (asset: any) => {
    const tempId = `upload-${Date.now()}`;
    let assetUri = asset?.uri || '';
    let assetType: 'image' | 'video' | 'document' = asset?.type === 'video' ? 'video' : (asset?.type === 'document' ? 'document' : 'image');

    try {
      // Camera/provider URIs can be returned before the native file is fully
      // materialized. Prepare one stable copy before showing/uploading it.
      const preparedAsset = await mediaService.prepareMediaForUpload(asset);
      assetUri = preparedAsset.uri;
      assetType = preparedAsset.type === 'video' ? 'video' : (preparedAsset.type === 'document' ? 'document' : 'image');

      setUploadingMessages(prev => [{
        id: tempId,
        content: '',
        localUri: preparedAsset.uri,
        type: assetType,
        status: 'uploading',
        createdAt: new Date().toISOString(),
        senderId: userId
      }, ...prev]);

      const result = await mediaService.uploadMedia(preparedAsset);
      
      // Remove optimistic uploading bubble BEFORE sending the message
      // to avoid visual duplication since sendMessage also adds an optimistic pending bubble.
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      
      await sendMessage(
        result.publicId,
        assetType,
        {
          publicId: result.publicId,
          url: result.url,
          fileName: preparedAsset.fileName,
          mimeType: preparedAsset.mimeType,
          fileSize: preparedAsset.fileSize,
        },
        preparedAsset.uri
      );
    } catch (err) {
      console.error('Error uploading media:', err);
      setUploadingMessages(prev => {
        if (prev.some(m => m.id === tempId)) {
          return prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m);
        }
        return [{
          id: tempId,
          content: '',
          localUri: assetUri,
          type: assetType,
          status: 'failed' as const,
          createdAt: new Date().toISOString(),
          senderId: userId
        }, ...prev];
      });
    }
  };

  const handleAudioSend = async (uri: string, duration: number) => {
    // Hide recorder immediately for instant feedback
    setIsRecordingMode(false);
    
    const tempId = `upload-audio-${Date.now()}`;
    try {
      // Show optimistic uploading bubble
      setUploadingMessages(prev => [{
        id: tempId,
        content: '',
        localUri: uri,
        type: 'audio',
        status: 'uploading',
        createdAt: new Date().toISOString(),
        senderId: userId,
        metadata: { duration }
      }, ...prev]);

      const audioAsset = { uri, type: 'audio' as const, fileName: `audio_${Date.now()}.m4a` };
      const result = await mediaService.uploadMedia(audioAsset);
      
      // Remove optimistic bubble BEFORE real one is created to avoid duplication
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      
      await sendMessage(
        result.publicId,
        'audio',
        {
          publicId: result.publicId,
          url: result.url,
          duration,
        },
        uri
      );
    } catch (err) {
      console.error('Error uploading audio:', err);
      setUploadingMessages(prev => {
        if (prev.some(m => m.id === tempId)) {
          return prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m);
        }
        return [{
          id: tempId,
          content: '',
          localUri: uri,
          type: 'audio' as const,
          status: 'failed' as const,
          createdAt: new Date().toISOString(),
          senderId: userId,
          metadata: { duration }
        }, ...prev];
      });
    }
  };

  const handleVideoNoteSend = async (uri: string, durationSec: number) => {
    setShowVideoNoteRecorder(false);

    const tempId = `upload-video-note-${Date.now()}`;
    try {
      setUploadingMessages(prev => [{
        id: tempId,
        content: '',
        localUri: uri,
        type: 'video',
        status: 'uploading',
        createdAt: new Date().toISOString(),
        senderId: userId,
        metadata: { duration: durationSec, isVideoNote: true },
      }, ...prev]);

      const videoAsset = {
        uri,
        type: 'video' as const,
        fileName: `video_note_${Date.now()}.mp4`,
        mimeType: 'video/mp4',
        duration: durationSec,
      };
      const result = await mediaService.uploadMedia(videoAsset);
      
      // Remove optimistic bubble BEFORE real one is created to avoid duplication
      setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
      
      await sendMessage(
        result.publicId,
        'video',
        {
          publicId: result.publicId,
          url: result.url,
          fileName: videoAsset.fileName,
          mimeType: videoAsset.mimeType,
          duration: durationSec,
          isVideoNote: true,
        },
        videoAsset.uri
      );
    } catch (err) {
      console.error('Error uploading video note:', err);
      setUploadingMessages(prev => {
        if (prev.some(m => m.id === tempId)) {
          return prev.map(m => m.id === tempId ? { ...m, status: 'failed' as const } : m);
        }
        return [{
          id: tempId,
          content: '',
          localUri: uri,
          type: 'video' as const,
          status: 'failed' as const,
          createdAt: new Date().toISOString(),
          senderId: userId,
          metadata: { duration: durationSec, isVideoNote: true },
        }, ...prev];
      });
    }
  };

  const [isCalling, setIsCalling] = useState(false);

  const handleCall = async () => {
    if (isCalling) return;
    setIsCalling(true);

    const roomName = `conv_${conversationId}`;
    const callSessionId = `call_${conversationId}_${Date.now()}`;
    const username = currentUser?.firstName || 'Usuario';

    // Send a message of type 'call' to trigger notification for the other user
    // We don't await this to avoid delaying the UI navigation
    sendMessage('Llamada iniciada', 'call', { roomName, callSessionId }).catch(err => {
      console.error('Failed to send call notification message:', err);
    });

    onNavigateCall(roomName, username, conversationId, userId, callSessionId);

    setTimeout(() => setIsCalling(false), 500);
  };

  const handleJoinCall = (callMessage?: Message) => {
    const metadataRoomName = callMessage?.metadata?.roomName;
    const metadataCallSessionId = callMessage?.metadata?.callSessionId;
    const roomName = typeof metadataRoomName === 'string' ? metadataRoomName : `conv_${conversationId}`;
    const callSessionId = typeof metadataCallSessionId === 'string' ? metadataCallSessionId : undefined;
    const username = currentUser?.firstName || 'Usuario';
    // Just join the existing room. Do NOT send a 'call' message.
    try {
      const answeredNativeCall =
        callKeepService.answerIncomingCallFromApp(roomName) ||
        callKeepService.answerIncomingCallFromApp(conversationId);

      if (!answeredNativeCall) {
        callKeepService.endAllCallsSilently();
      }
    } catch (error) {
      console.warn('[CALL_DEBUG] Could not synchronize native call UI before joining call:', error);
    }

    const shouldHandoffActiveCall =
      CallState.isInsideCallScreen &&
      !CallState.matchesActiveCallScreen({
        roomName,
        conversationId,
        callSessionId,
      });

    if (shouldHandoffActiveCall) {
      console.log('[CALL_DEBUG] Join call requested while another call is active; hanging up current call first.', {
        nextRoomName: roomName,
        nextConversationId: conversationId,
        nextCallSessionId: callSessionId,
      });
      DeviceEventEmitter.emit(HANDOFF_ACTIVE_CALL_EVENT, {
        roomName,
        conversationId,
        callSessionId,
      });
      setTimeout(() => {
        onNavigateCall(roomName, username, conversationId, userId, callSessionId, { suppressRinging: true });
      }, 450);
      return;
    }

    onNavigateCall(roomName, username, conversationId, userId, callSessionId, { suppressRinging: true });
  };

  // ── Message long-press actions ──────────────────────────────────────────
  const handleLongPress = (msg: Message) => {
    setActionMessage(msg);
  };

  const handleTextChange = (text: string) => {
    setMessageText(text);
    setIsTyping(text.length > 0);
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setMessageText(msg.content);
    setIsTyping(msg.content.length > 0);
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
          onPress: () => {
            deleteMessage(msg.serverId || msg.id);
          },
        },
      ],
    );
  };

  const handleTextToSpeech = () => {
    onNavigate('communication_board');
  };

  const handleAudioRecorderMode = () => {
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
    if (isGroup) {
      return (
        <GroupProfileView
          conversationId={conversationId}
          groupName={otherUserName}
          groupDescription={groupDescription}
          groupImage={otherUserAvatar}
          userId={userId}
          onBack={() => setShowProfile(false)}
          onLeave={() => {
            setShowProfile(false);
            onBack();
          }}
          onUpdate={(updates) => {
            if (onGroupUpdate) onGroupUpdate(updates);
          }}
          onNavigate={onNavigate}
        />
      );
    }

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
        typingUsers={typingUsers}
      />

      <MessageList
        messages={messages}
        uploadingMessages={uploadingMessages}
        userId={userId}
        isGroup={isGroup}
        onLongPress={handleLongPress}
        onSwipeReply={(msg) => setReplyMessage(msg)}
        onJoinCall={handleJoinCall}
        colors={colors}
        isDark={isDark}
        swipeableRefs={swipeableRefs}
        readReceiptsEnabled={currentUser?.readReceiptsEnabled ?? true}
        onNeedUpgrade={(feature) => {
          setUpgradeFeature(feature);
          setShowUpgradeModal(true);
        }}
        onRetryUpload={retryUpload}
        onDismissUpload={dismissFailedUpload}
      />

      {isRecordingMode ? (
        <AudioRecorder onSend={handleAudioSend} onCancel={() => setIsRecordingMode(false)} />
      ) : (
        <ChatInput
          messageText={messageText}
          setMessageText={handleTextChange}
          onSend={handleSend}
          onMediaPick={handleMediaPick}
          onAudioRecorderMode={handleAudioRecorderMode}
          onVideoTranslatorPress={handleVideoTranslatorPress}
          onTextToSpeech={handleTextToSpeech}
          onCorrection={handleCorrection}
          isCorrecting={isCorrecting}
          correctionOpacity={correctionOpacity}
          correctionLimit={correctionLimit}
          correctionUsesToday={correctionUsesToday}
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
        onUpgradePress={() => {
          setShowUpgradeModal(false);
          onNavigate('profile', { openManagePlan: true });
        }}
      />

      <AttachmentMenu
        visible={showAttachmentMenu}
        onClose={() => setShowAttachmentMenu(false)}
        onPickMedia={async () => {
          const asset = await mediaService.pickMedia();
          if (asset) await processAsset(asset);
        }}
        onPickDocument={async () => {
          const asset = await mediaService.pickDocument();
          if (asset) await processAsset(asset);
        }}
        onTakePhoto={async () => {
          const asset = await mediaService.takePhoto();
          if (asset) await processAsset(asset);
        }}
        onRecordVideo={async () => {
          const asset = await mediaService.recordVideo();
          if (asset) await processAsset(asset);
        }}
        onRecordVideoNote={() => setShowVideoNoteRecorder(true)}
      />

      <VideoNoteRecorder
        visible={showVideoNoteRecorder}
        onClose={() => setShowVideoNoteRecorder(false)}
        onSend={handleVideoNoteSend}
      />
    </View>
  );
}
