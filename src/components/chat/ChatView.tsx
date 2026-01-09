/**
 * ChatView Component
 * 
 * Individual chat conversation view with messages, input, and call functionality.
 * Enhanced with:
 * - Optimistic Media Uploads
 * - Advanced Audio Recorder
 * - Swipe to Reply
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    FlatList,
    Animated,
    Alert,
    Image,
    Keyboard,
    Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useChat } from '../../hooks/useChat';
import { chatService } from '../../services/chat.service';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { AddContactModal } from '../AddContactModal';
import { ContactProfileScreen } from './ContactProfileScreen';
import { GroupProfileView } from './GroupProfileView';
import { MessageBubble } from './MessageBubble';
import { AudioRecorder } from './AudioRecorder';
import { MagicPencilIcon } from '../icons/ActionIcons';
import {
    BackArrowIcon,
    MicrophoneIcon,
    SendIcon,
    PlusIcon,
    VideoCallIcon,
} from '../icons/NavigationIcons';
import { mediaService } from '../../services/media.service';
import { Ionicons } from '@expo/vector-icons';
import { StreamingLSCRecorder } from './StreamingLSCRecorder';

export interface ChatViewProps {
    conversationId: string;
    otherUserName: string;
    otherUserPhone?: string;
    otherUserId?: string;
    isUnknown?: boolean;
    userId: string;
    currentUser?: any;
    onBack: () => void;
    onAddContact?: () => void;
    onContactUpdate?: (contact: any) => void;
    onNavigateCall: (roomName: string, username: string, conversationId: string, userId: string) => void;
    // Contact info for profile
    contactId?: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
    otherUserAvatar?: string;
    isGroup?: boolean;
    groupDescription?: string;
}

interface UploadingMessage {
    id: string;
    content: string; // "Uploading..."
    localUri: string;
    type: 'image' | 'video' | 'audio';
    status: 'uploading' | 'failed';
    createdAt: string;
    progress?: number;
    metadata?: any;
}

export function ChatView({
    conversationId,
    otherUserName,
    otherUserPhone,
    otherUserId,
    isUnknown,
    userId,
    currentUser,
    onBack,
    onAddContact,
    onContactUpdate,
    onNavigateCall,
    contactId,
    alias,
    customFirstName,
    customLastName,
    otherUserAvatar,
    isGroup,
    groupDescription,
}: ChatViewProps) {
    const { messages, sendMessage, isLoading } = useChat(conversationId, userId);
    const [messageText, setMessageText] = useState('');
    const [isCorrecting, setIsCorrecting] = useState(false);
    const correctionOpacity = useRef(new Animated.Value(0)).current;

    // UI States
    const [showAddContactModal, setShowAddContactModal] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [contactSaved, setContactSaved] = useState(false);
    const [currentDisplayName, setCurrentDisplayName] = useState(otherUserName);
    const [currentDescription, setCurrentDescription] = useState(groupDescription);
    const [currentGroupImage, setCurrentGroupImage] = useState(otherUserAvatar);

    // Media & Input States
    const [uploadingMessages, setUploadingMessages] = useState<UploadingMessage[]>([]);
    const [isRecordingMode, setIsRecordingMode] = useState(false);
    const [replyMessage, setReplyMessage] = useState<any | null>(null);
    const [showVideoTranslator, setShowVideoTranslator] = useState(false);

    // Refs for swipeable components
    const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

    // Create animated component for LinearGradient
    const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

    const handleSend = async () => {
        if (!messageText.trim()) return;

        const content = messageText.trim();
        let replyContent = replyMessage ? replyMessage.content : '';

        if (replyMessage) {
            if (replyMessage.type === 'image') replyContent = '📷 Foto';
            else if (replyMessage.type === 'video') replyContent = '🎥 Video';
            else if (replyMessage.type === 'audio') {
                const duration = replyMessage.metadata?.duration ? Math.round(replyMessage.metadata.duration) : 0;
                const minutes = Math.floor(duration / 60);
                const seconds = duration % 60;
                replyContent = `🎤 Audio (${minutes}:${seconds.toString().padStart(2, '0')})`;
            }
        }

        const metadata = replyMessage ? {
            replyToId: replyMessage.id,
            replyToContent: replyContent,
            replyToSender: replyMessage.senderId === userId ? 'Tú' : currentDisplayName
        } : undefined;

        setMessageText('');
        setReplyMessage(null); // Clear reply context

        await sendMessage(content, 'text', metadata);
    };

    const handleCorrection = async () => {
        if (!messageText.trim() || isCorrecting || isLoading) return;

        setIsCorrecting(true);
        Animated.loop(
            Animated.sequence([
                Animated.timing(correctionOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(correctionOpacity, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        try {
            await chatService.correctMessageStream(
                messageText,
                (partialText) => {
                    setMessageText(partialText);
                }
            );
        } catch (error) {
            console.error('Correction failed:', error);
        } finally {
            setIsCorrecting(false);
            correctionOpacity.setValue(0);
        }
    };

    // Format message time
    const formatTime = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const startCall = async () => {
        await chatService.sendMessage({
            conversationId,
            senderId: userId,
            content: '📞 Inició una videollamada',
            type: 'call'
        });
        const myName = currentUser?.firstName || currentUser?.email || 'Usuario';
        onNavigateCall(conversationId, myName, conversationId, userId);
    };

    const joinCall = () => {
        const myName = currentUser?.firstName || currentUser?.email || 'Usuario';
        onNavigateCall(conversationId, myName, conversationId, userId);
    };

    const handleMediaPick = async () => {
        try {
            const media = await mediaService.pickMedia();
            if (!media) return;

            // 1. Create Optimistic Upload Message
            const tempId = `temp_${Date.now()}`;
            const optimisticMsg: UploadingMessage = {
                id: tempId,
                content: media.type === 'video' ? '🎥 Subiendo video...' : '📷 Subiendo foto...',
                localUri: media.uri,
                type: media.type,
                status: 'uploading',
                createdAt: new Date().toISOString()
            };

            setUploadingMessages(prev => [optimisticMsg, ...prev]);

            // 2. Upload in Background
            try {
                const { publicId, url, type } = await mediaService.uploadMedia(media);

                // 3. Remove preview BEFORE sendMessage to avoid duplication
                setUploadingMessages(prev => prev.filter(m => m.id !== tempId));

                // 4. Send Real Message (this creates its own optimistic message in local DB)
                const content = type === 'video' ? url : url; // Use URL as content for playback
                await sendMessage(content, type as any, { publicId }, media.uri);

            } catch (error) {
                console.error('Upload failed', error);
                Alert.alert('Error', 'Falló la subida del archivo');
                setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } catch (error) {
            console.error('Pick media failed:', error);
        }
    };

    const handleAudioSend = async (uri: string, duration: number) => {
        setIsRecordingMode(false);

        // Optimistic Audio
        const tempId = `temp_audio_${Date.now()}`;
        const optimisticMsg: UploadingMessage = {
            id: tempId,
            content: '🎤 Enviando audio...',
            localUri: uri,
            type: 'audio',
            status: 'uploading',
            createdAt: new Date().toISOString(),
            metadata: { duration }
        };
        setUploadingMessages(prev => [optimisticMsg, ...prev]);

        try {
            const { publicId, url } = await mediaService.uploadMedia({ uri, type: 'audio' } as any);
            // Remove preview BEFORE sendMessage to avoid duplication
            setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
            // Use URL as content so recipient can play audio directly
            await sendMessage(url, 'audio', { publicId, duration }, uri);
        } catch (error) {
            console.error('Audio upload failed', error);
            Alert.alert('Error', 'Falló el envío del audio');
            setUploadingMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    const renderReplyPreview = () => {
        if (!replyMessage) return null;

        let previewContent = replyMessage.content;
        if (replyMessage.type === 'image') previewContent = '📷 Foto';
        else if (replyMessage.type === 'video') previewContent = '🎥 Video';
        else if (replyMessage.type === 'audio') {
            const duration = replyMessage.metadata?.duration ? Math.round(replyMessage.metadata.duration) : 0;
            const minutes = Math.floor(duration / 60);
            const seconds = duration % 60;
            previewContent = `🎤 Audio (${minutes}:${seconds.toString().padStart(2, '0')})`;
        }

        return (
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.05)',
                padding: 8,
                borderLeftWidth: 4,
                borderLeftColor: '#4F46E5',
                marginBottom: 4
            }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#4F46E5', fontWeight: 'bold', fontSize: 12 }}>
                        Respondiendo a {replyMessage.isMine ? 'ti mismo' : currentDisplayName}
                    </Text>
                    <Text numberOfLines={1} style={{ color: '#666', fontSize: 12 }}>
                        {previewContent}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyMessage(null)}>
                    <Ionicons name="close-circle" size={20} color="#666" />
                </TouchableOpacity>
            </View>
        );
    };

    const renderMessageItem = ({ item }: { item: any }) => {
        // Check if it's a real message or uploading message
        const isUploading = item.status === 'uploading';

        if (isUploading) {
            return (
                <View style={{ opacity: 0.7 }}>
                    <MessageBubble
                        content={item.localUri} // Pass URI as content for rendering
                        time={item.createdAt}
                        isMine={true}
                        isSynced={false} // Pending icon
                        type={item.type}
                    />
                    <ActivityIndicator
                        style={{ position: 'absolute', alignSelf: 'center', top: '40%' }}
                        color="white"
                    />
                </View>
            );
        }

        // Real Message
        const msg = item;
        const isMe = msg.senderId === userId;

        // Custom render for calls
        if (msg.type === 'call') {
            const hasEnded = messages.some(m =>
                m.type === 'call_ended' &&
                new Date(m.createdAt).getTime() > new Date(msg.createdAt).getTime()
            );
            return (
                <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
                    <View style={{ backgroundColor: '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
                        <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>📞 Videollamada</Text>
                        <Text style={{ marginBottom: 10 }}>{isMe ? 'Iniciaste una llamada' : 'Te invitaron a una llamada'}</Text>
                        {!hasEnded ? (
                            <TouchableOpacity onPress={joinCall} style={{ backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>Unirse ahora</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={{ color: '#6B7280', fontStyle: 'italic', fontSize: 12 }}>Llamada finalizada</Text>
                        )}
                    </View>
                </View>
            );
        }
        if (msg.type === 'call_ended') {
            return (
                <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
                    <View style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 15, alignItems: 'center' }}>
                        <Text style={{ color: '#6B7280', fontSize: 12 }}>📞 Videollamada finalizada</Text>
                    </View>
                </View>
            );
        }

        // Check if this message is being replied to
        const isBeingRepliedTo = replyMessage?.id === msg.id;

        // Swipeable Wrapper
        return (
            <View style={isBeingRepliedTo ? {
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                borderLeftWidth: 3,
                borderLeftColor: '#4F46E5',
                paddingLeft: 4,
                marginVertical: 2,
                borderRadius: 8,
            } : undefined}>
                <Swipeable
                    ref={(ref) => {
                        if (ref) swipeableRefs.current.set(msg.id, ref);
                    }}
                    renderRightActions={() => (
                        <View style={{ width: 60, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="arrow-undo" size={24} color="#666" />
                        </View>
                    )}
                    onSwipeableWillOpen={() => {
                        setReplyMessage(msg);
                        Vibration.vibrate(50);
                        // Close swipeable immediately to return to original position
                        const swipeable = swipeableRefs.current.get(msg.id);
                        if (swipeable) {
                            swipeable.close();
                        }
                    }}
                >
                    <MessageBubble
                        content={msg.content}
                        time={msg.createdAt}
                        isMine={isMe}
                        isSynced={msg.status !== 'pending'}
                        isRead={msg.status === 'read'}
                        type={msg.type || 'text'}
                        replyToContent={msg.replyToContent}
                        replyToSender={msg.replyToSender}
                        publicId={msg.metadata?.publicId}
                    />
                </Swipeable>
            </View>
        );
    };

    // Combine messages: uploading items at TOP (because list is inverted) + real messages
    const combinedMessages = [...uploadingMessages, ...messages];
    // Note: uploadingMessages are new, so they should be at the BEGINNING of the array for Inverted List.
    // wait, `messages` from useChat are usually sorted NEWEST FIRST if we reversed them in render.
    // useChat returns array sorted by time? Usually DB returns oldest first.
    // ChatView previously did: `data={[...messages].reverse()}`
    // If uploadingMessages are newest, they should be prepended to the reversed list.

    const displayData = [...uploadingMessages, ...[...messages].reverse()];

    // Profile View
    if (showProfile) {
        // Group Profile View (simplified)
        if (isGroup) {
            return (
                <GroupProfileView
                    conversationId={conversationId}
                    groupName={currentDisplayName}
                    groupDescription={currentDescription}
                    groupImage={currentGroupImage}
                    userId={userId}
                    onBack={() => setShowProfile(false)}
                    onLeave={() => {
                        setShowProfile(false);
                        onBack(); // Navigation back to list
                    }}
                    onUpdate={(updates) => {
                        if (updates.title) setCurrentDisplayName(updates.title);
                        if (updates.imageUrl) setCurrentGroupImage(updates.imageUrl);
                        if (updates.description) setCurrentDescription(updates.description);
                        if (onContactUpdate) onContactUpdate(updates);
                    }}
                />
            );
        }

        // Contact Profile View (for direct chats)
        return (
            <ContactProfileScreen
                userId={userId}
                otherUserId={otherUserId || conversationId.replace('contact-', '')}
                otherUserPhone={otherUserPhone}
                contactId={contactId}
                isContact={!isUnknown}
                displayName={currentDisplayName}
                alias={alias}
                customFirstName={customFirstName}
                customLastName={customLastName}
                avatarUrl={otherUserAvatar}
                conversationId={conversationId}
                onBack={() => setShowProfile(false)}
                onContactUpdated={(contact) => {
                    const newName = contact.alias || `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() || contact.phone;
                    setCurrentDisplayName(newName);
                    setShowProfile(false);
                    if (onContactUpdate) onContactUpdate(contact);
                }}
                onContactAdded={(contact) => {
                    const newName = contact.alias || `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() || contact.phone;
                    setCurrentDisplayName(newName);
                    setContactSaved(true);
                    setShowProfile(false);
                    if (onContactUpdate) onContactUpdate(contact);
                }}
            />
        );
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View style={chatViewStyles.container}>
                {/* Header */}
                <View style={chatViewStyles.header}>
                    <TouchableOpacity onPress={onBack} style={chatViewStyles.backBtn}>
                        <BackArrowIcon size={24} color="#000" />
                    </TouchableOpacity>

                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => setShowProfile(true)}>
                        <View style={chatViewStyles.avatarSmall}>
                            {otherUserAvatar ? (
                                <Image source={{ uri: otherUserAvatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                            ) : (
                                <Text style={chatViewStyles.avatarSmallText}>{currentDisplayName.charAt(0).toUpperCase()}</Text>
                            )}
                        </View>
                        <View style={chatViewStyles.headerInfo}>
                            <Text style={chatViewStyles.chatName}>{currentDisplayName}</Text>
                            {otherUserPhone && <Text style={chatViewStyles.lastMessage}>{otherUserPhone}</Text>}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity style={{ padding: 8 }} onPress={startCall}>
                        <VideoCallIcon size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                {isUnknown && !contactSaved && (
                    <TouchableOpacity onPress={() => setShowAddContactModal && setShowAddContactModal(true)} style={chatViewStyles.addContactFloatingBox}>
                        <Text style={chatViewStyles.addContactFloatingText}>Añadir contacto</Text>
                    </TouchableOpacity>
                )}

                {/* Messages List */}
                <FlatList
                    data={displayData}
                    inverted
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingVertical: 16 }}
                    style={chatViewStyles.messagesContainer}
                    keyboardDismissMode="on-drag"
                    ListEmptyComponent={
                        <View style={chatViewStyles.emptyContainer}>
                            <Text style={chatViewStyles.emptyText}>No hay mensajes aún</Text>
                            <Text style={chatViewStyles.emptySubtext}>¡Envía el primero!</Text>
                        </View>
                    }
                    renderItem={renderMessageItem}
                />

                {/* Input Area */}
                {!isRecordingMode ? (
                    <View style={chatViewStyles.inputContainer}>
                        {renderReplyPreview()}
                        <View style={chatViewStyles.inputRow}>
                            <TouchableOpacity style={chatViewStyles.mediaButton} onPress={handleMediaPick}>
                                <PlusIcon size={24} color="#666666" />
                            </TouchableOpacity>

                            {/* Video Translation Button */}
                            <TouchableOpacity
                                style={chatViewStyles.mediaButton}
                                onPress={() => setShowVideoTranslator(true)}
                            >
                                <Ionicons name="videocam" size={22} color="#4F46E5" />
                            </TouchableOpacity>

                            <View style={chatViewStyles.inputWrapper}>
                                <AnimatedGradient
                                    colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 105, 180, 0.3)', 'rgba(0, 191, 255, 0.3)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, { opacity: correctionOpacity }]}
                                />
                                <TextInput
                                    style={chatViewStyles.textInput}
                                    placeholder="Escribe un mensaje..."
                                    placeholderTextColor="#9CA3AF"
                                    multiline
                                    value={messageText}
                                    onChangeText={setMessageText}
                                />
                                <TouchableOpacity style={[chatViewStyles.pencilButton, { opacity: isCorrecting ? 0.5 : 1 }]} onPress={handleCorrection} disabled={isCorrecting}>
                                    <Animated.View style={{ opacity: correctionOpacity }}>
                                        <MagicPencilIcon size={24} />
                                    </Animated.View>
                                    <View style={{ position: 'absolute', opacity: isCorrecting ? 0 : 1 }}>
                                        <MagicPencilIcon size={24} />
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {messageText.trim() ? (
                                <TouchableOpacity style={chatViewStyles.sendButton} onPress={handleSend}>
                                    <SendIcon size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={chatViewStyles.micButton}
                                    onPress={() => setIsRecordingMode(true)}
                                >
                                    <MicrophoneIcon size={24} color="#666666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                ) : (
                    // Audio Recorder Interface
                    <AudioRecorder
                        onSend={handleAudioSend}
                        onCancel={() => setIsRecordingMode(false)}
                    />
                )}

                {/* Add Contact Modal */}
                {isUnknown && (
                    <AddContactModal
                        visible={showAddContactModal}
                        onClose={() => setShowAddContactModal(false)}
                        onContactAdded={(contact) => {
                            setShowAddContactModal(false);
                            setContactSaved(true);
                            if (onContactUpdate && contact) onContactUpdate(contact);
                        }}
                        userId={userId}
                        initialPhone={otherUserPhone || ''}
                    />
                )}

                {/* Streaming LSC Recorder */}
                <StreamingLSCRecorder
                    visible={showVideoTranslator}
                    onClose={() => setShowVideoTranslator(false)}
                    onTranslationReceived={(text) => {
                        setMessageText(prev => prev ? `${prev} ${text}` : text);
                    }}
                />
            </View>
        </GestureHandlerRootView>
    );
}
