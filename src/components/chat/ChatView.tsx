/**
 * ChatView Component
 * 
 * Individual chat conversation view with messages, input, and call functionality.
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useChat } from '../../hooks/useChat';
import { chatService } from '../../services/chat.service';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { AddContactModal } from '../AddContactModal';
import { ContactProfileScreen } from './ContactProfileScreen';
import { MessageBubble } from './MessageBubble';
import { MagicPencilIcon } from '../icons/ActionIcons';
import {
    BackArrowIcon,
    MicrophoneIcon,
    SendIcon,
    PlusIcon,
    VideoCallIcon,
} from '../icons/NavigationIcons';
import { mediaService } from '../../services/media.service';

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
}: ChatViewProps) {
    const { messages, sendMessage, isLoading } = useChat(conversationId, userId);
    const [messageText, setMessageText] = useState('');
    const [isCorrecting, setIsCorrecting] = useState(false);
    const correctionOpacity = React.useRef(new Animated.Value(0)).current;
    const [showAddContactModal, setShowAddContactModal] = useState(false);
    const [isUploadingMedia, setIsUploadingMedia] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [contactSaved, setContactSaved] = useState(false);
    const [currentDisplayName, setCurrentDisplayName] = useState(otherUserName);


    // Create animated component for LinearGradient
    const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

    // Auto-scroll handled by inverted FlatList
    // useEffect(() => {
    //     if (scrollViewRef.current) {
    //         scrollViewRef.current.scrollToEnd({ animated: true });
    //     }
    // }, [messages]);

    const handleSend = async () => {
        if (!messageText.trim()) return;
        const content = messageText.trim();
        setMessageText('');
        await sendMessage(content);
    };

    const handleCorrection = async () => {
        if (!messageText.trim() || isCorrecting || isLoading) return;

        setIsCorrecting(true);
        Animated.loop(
            Animated.sequence([
                Animated.timing(correctionOpacity, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(correctionOpacity, {
                    toValue: 0.5,
                    duration: 1000,
                    useNativeDriver: true,
                }),
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
        // 1. Send invite message
        await chatService.sendMessage({
            conversationId,
            senderId: userId,
            content: '📞 Inició una videollamada',
            type: 'call'
        });
        // 2. Navigate using MY identity
        const myName = currentUser?.firstName || currentUser?.email || 'Usuario';
        onNavigateCall(conversationId, myName, conversationId, userId);
    };

    const joinCall = () => {
        const myName = currentUser?.firstName || currentUser?.email || 'Usuario';
        onNavigateCall(conversationId, myName, conversationId, userId);
    };

    const handleMediaPick = async () => {
        if (isUploadingMedia) return;

        try {
            // 1. Pick image/video from gallery
            const media = await mediaService.pickMedia();
            if (!media) return; // User cancelled or file too large

            setIsUploadingMedia(true);

            // 2. Upload to Cloudinary Securely (via API Gateway)
            const { publicId, type } = await mediaService.uploadMedia(media);

            // 3. Send message
            // Content: Placeholder text (backend uses this for notifications/display fallback)
            // Type: image/video
            // Metadata: { publicId }
            // LocalContent: media.uri (for instant optimistic display)
            const content = type === 'video' ? '🎥 Video' : '📷 Foto';
            await sendMessage(content, type as any, { publicId }, media.uri);

        } catch (error) {
            console.error('Media upload failed:', error);
            Alert.alert('Error', 'Error al subir el archivo. Intenta de nuevo.');
        } finally {
            setIsUploadingMedia(false);
        }
    };

    const handleAudioStart = async () => {
        if (isRecording || isUploadingMedia) return;
        const started = await mediaService.startRecording();
        if (started) {
            setIsRecording(true);
        }
    };

    const handleAudioStop = async () => {
        if (!isRecording) return;
        setIsRecording(false);
        setIsUploadingMedia(true);

        try {
            const audio = await mediaService.stopRecording();
            if (audio) {
                const { publicId } = await mediaService.uploadMedia(audio);
                await sendMessage('🎤 Audio', 'audio', { publicId }, audio.uri);
            }
        } catch (error) {
            console.error('Audio upload failed:', error);
            Alert.alert('Error', 'Error al enviar el audio.');
        } finally {
            setIsUploadingMedia(false);
        }
    };

    // Show profile screen if active
    if (showProfile) {
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
                    const newName = contact.alias ||
                        `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
                        contact.phone;
                    setCurrentDisplayName(newName);
                    setShowProfile(false);
                    if (onContactUpdate) onContactUpdate(contact);
                }}
                onContactAdded={(contact) => {
                    const newName = contact.alias ||
                        `${contact.customFirstName || ''} ${contact.customLastName || ''}`.trim() ||
                        contact.phone;
                    setCurrentDisplayName(newName);
                    setContactSaved(true);
                    setShowProfile(false);
                    if (onContactUpdate) onContactUpdate(contact);
                }}
            />
        );
    }

    return (
        <View style={chatViewStyles.container}>
            {/* Header */}
            <View style={chatViewStyles.header}>
                <TouchableOpacity onPress={onBack} style={chatViewStyles.backBtn}>
                    <BackArrowIcon size={24} color="#000" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    onPress={() => setShowProfile(true)}
                >
                    <View style={chatViewStyles.avatarSmall}>
                        {otherUserAvatar ? (
                            <Image
                                source={{ uri: otherUserAvatar }}
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                }}
                            />
                        ) : (
                            <Text style={chatViewStyles.avatarSmallText}>
                                {currentDisplayName.charAt(0).toUpperCase()}
                            </Text>
                        )}
                    </View>

                    <View style={chatViewStyles.headerInfo}>
                        <Text style={chatViewStyles.chatName}>{currentDisplayName}</Text>
                        {otherUserPhone && (
                            <Text style={chatViewStyles.lastMessage}>{otherUserPhone}</Text>
                        )}
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={{ padding: 8 }} onPress={startCall}>
                    <VideoCallIcon size={24} color="#000" />
                </TouchableOpacity>
            </View>

            {isUnknown && (
                <TouchableOpacity onPress={() => setShowAddContactModal && setShowAddContactModal(true)} style={chatViewStyles.addContactFloatingBox}>
                    <Text style={chatViewStyles.addContactFloatingText}>Añadir contacto</Text>
                </TouchableOpacity>
            )}

            {/* Messages */}
            {/* Messages */}
            {isLoading && messages.length === 0 ? (
                <View style={chatViewStyles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7FA889" />
                </View>
            ) : (
                <FlatList
                    data={[...messages].reverse()}
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
                    renderItem={({ item: msg }) => {
                        const isMe = msg.senderId === userId;

                        // For call messages, check if there's a call_ended after it
                        // Note: inside flattened list (reversed), 'after' means 'before' index, but logic is tricky
                        // It's easier to just handle call display logic simpler or rely on standard rendering
                        // For now we preserve specific call rendering logic but adapted for item

                        if (msg.type === 'call') {
                            // Simplified call rendering for FlatList to avoid complex lookups
                            return (
                                <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
                                    <View style={{ backgroundColor: '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>
                                            📞 Videollamada
                                        </Text>
                                        <Text style={{ marginBottom: 10 }}>{isMe ? 'Iniciaste una llamada' : 'Te invitaron a una llamada'}</Text>
                                        <TouchableOpacity
                                            onPress={joinCall}
                                            style={{ backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                                        >
                                            <Text style={{ color: 'white', fontWeight: 'bold' }}>Unirse ahora</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        }

                        if (msg.type === 'call_ended') {
                            return (
                                <View style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
                                    <View style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 15, alignItems: 'center' }}>
                                        <Text style={{ color: '#6B7280', fontSize: 12 }}>
                                            📞 Videollamada finalizada
                                        </Text>
                                    </View>
                                </View>
                            );
                        }

                        return (
                            <View>
                                <MessageBubble
                                    content={msg.content}
                                    time={msg.createdAt}
                                    isMine={isMe}
                                    isSynced={msg.status !== 'pending'}
                                    isRead={msg.status === 'read'}
                                    type={msg.type || 'text'}
                                />
                            </View>
                        );
                    }}
                />
            )}

            {/* Input Area */}
            <View style={chatViewStyles.inputContainer}>
                <View style={chatViewStyles.inputRow}>
                    <TouchableOpacity
                        style={[chatViewStyles.mediaButton, isUploadingMedia && { opacity: 0.5 }]}
                        onPress={handleMediaPick}
                        disabled={isUploadingMedia}
                    >
                        {isUploadingMedia ? (
                            <ActivityIndicator size="small" color="#666666" />
                        ) : (
                            <PlusIcon size={24} color="#666666" />
                        )}
                    </TouchableOpacity>

                    <View style={chatViewStyles.inputWrapper}>
                        {/* Gradient Overlay when correcting */}
                        <AnimatedGradient
                            colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 105, 180, 0.3)', 'rgba(0, 191, 255, 0.3)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[
                                { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
                                { opacity: correctionOpacity }
                            ]}
                        />
                        <TextInput
                            style={chatViewStyles.textInput}
                            placeholder="Escribe un mensaje..."
                            placeholderTextColor="#9CA3AF"
                            multiline
                            value={messageText}
                            onChangeText={setMessageText}
                        />
                        <TouchableOpacity
                            style={[chatViewStyles.pencilButton, { opacity: isCorrecting ? 0.5 : 1 }]}
                            onPress={handleCorrection}
                            disabled={isCorrecting}
                        >
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
                            style={[chatViewStyles.micButton, isRecording && { backgroundColor: '#EF4444' }]}
                            onPressIn={handleAudioStart}
                            onPressOut={handleAudioStop}
                        >
                            {isRecording ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <MicrophoneIcon size={24} color="#666666" />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Add Contact Modal for unknown users */}
            {
                isUnknown && (
                    <AddContactModal
                        visible={showAddContactModal}
                        onClose={() => setShowAddContactModal(false)}
                        onContactAdded={(contact) => {
                            setShowAddContactModal(false);
                            setContactSaved(true); // Hide floating box after saving
                            if (onContactUpdate && contact) {
                                onContactUpdate(contact);
                            }
                        }}
                        userId={userId}
                        initialPhone={otherUserPhone || ''}
                    />
                )
            }
        </View>
    );
}
