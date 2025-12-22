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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useChat } from '../../hooks/useChat';
import { chatService } from '../../services/chat.service';
import { chatViewStyles } from '../../styles/ChatsScreen.styles';
import { AddContactModal } from '../AddContactModal';
import { ContactProfileScreen } from './ContactProfileScreen';
import { MagicPencilIcon } from '../icons/ActionIcons';
import {
    BackArrowIcon,
    MicrophoneIcon,
    SendIcon,
    PlusIcon,
    VideoCallIcon,
} from '../icons/NavigationIcons';

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
}: ChatViewProps) {
    const { messages, sendMessage, isLoading } = useChat(conversationId, userId);
    const [messageText, setMessageText] = useState('');
    const [isCorrecting, setIsCorrecting] = useState(false);
    const correctionOpacity = React.useRef(new Animated.Value(0)).current;
    const [showAddContactModal, setShowAddContactModal] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [contactSaved, setContactSaved] = useState(false);
    const [currentDisplayName, setCurrentDisplayName] = useState(otherUserName);
    const scrollViewRef = React.useRef<ScrollView>(null);

    // Create animated component for LinearGradient
    const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
        }
    }, [messages]);

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
                        <Text style={chatViewStyles.avatarSmallText}>
                            {currentDisplayName.charAt(0).toUpperCase()}
                        </Text>
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
            {isLoading && messages.length === 0 ? (
                <View style={chatViewStyles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7FA889" />
                </View>
            ) : (
                <ScrollView
                    ref={scrollViewRef}
                    style={chatViewStyles.messagesContainer}
                    contentContainerStyle={chatViewStyles.messagesContent}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.length === 0 ? (
                        <View style={chatViewStyles.emptyContainer}>
                            <Text style={chatViewStyles.emptyText}>No hay mensajes aún</Text>
                            <Text style={chatViewStyles.emptySubtext}>¡Envía el primero!</Text>
                        </View>
                    ) : (
                        messages.map((msg, index) => {
                            const isMe = msg.senderId === userId;

                            // For call messages, check if there's a call_ended after it
                            if (msg.type === 'call') {
                                // Check if any subsequent message is call_ended
                                const hasEnded = messages.slice(index + 1).some(m => m.type === 'call_ended');

                                return (
                                    <View key={msg.id} style={[chatViewStyles.messageBubbleContainer, { alignSelf: 'center', marginVertical: 10 }]}>
                                        <View style={{ backgroundColor: hasEnded ? '#F3F4F6' : '#E0E7FF', padding: 15, borderRadius: 15, alignItems: 'center' }}>
                                            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>
                                                {hasEnded ? '📞 Videollamada finalizada' : '📞 Videollamada'}
                                            </Text>
                                            {!hasEnded && (
                                                <>
                                                    <Text style={{ marginBottom: 10 }}>{isMe ? 'Has iniciado una llamada' : 'Te invitaron a una llamada'}</Text>
                                                    <TouchableOpacity
                                                        onPress={joinCall}
                                                        style={{ backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                                                    >
                                                        <Text style={{ color: 'white', fontWeight: 'bold' }}>Unirse ahora</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                );
                            }

                            // Hide call_ended messages (already handled above)
                            if (msg.type === 'call_ended') {
                                return null;
                            }

                            return (
                                <View
                                    key={msg.id}
                                    style={[
                                        chatViewStyles.messageBubbleContainer,
                                        isMe ? chatViewStyles.myMessage : chatViewStyles.theirMessage,
                                    ]}
                                >
                                    <View
                                        style={[
                                            chatViewStyles.messageBubble,
                                            isMe ? chatViewStyles.myBubble : chatViewStyles.theirBubble,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                chatViewStyles.messageText,
                                                isMe ? chatViewStyles.myMessageText : chatViewStyles.theirMessageText,
                                            ]}
                                        >
                                            {msg.content}
                                        </Text>

                                        <View style={chatViewStyles.messageFooter}>
                                            <Text
                                                style={[
                                                    chatViewStyles.messageTime,
                                                    isMe ? chatViewStyles.myTime : chatViewStyles.theirTime,
                                                ]}
                                            >
                                                {formatTime(msg.createdAt)}
                                            </Text>
                                            {/* WhatsApp-style checkmarks */}
                                            {isMe && (
                                                <Text style={[
                                                    chatViewStyles.checkmarks,
                                                    {
                                                        color: msg.status === 'read'
                                                            ? '#53BDEB'  // Blue for read
                                                            : msg.status === 'pending'
                                                                ? 'rgba(255, 255, 255, 0.4)'  // Faded for pending
                                                                : 'rgba(255, 255, 255, 0.6)'  // Normal for sent/delivered
                                                    }
                                                ]}>
                                                    {msg.status === 'pending' ? '⏳' :
                                                        msg.status === 'sent' ? '✓' :
                                                            '✓✓'}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </ScrollView>
            )}

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={chatViewStyles.inputContainer}>
                    <View style={chatViewStyles.inputRow}>
                        <TouchableOpacity style={chatViewStyles.mediaButton}>
                            <PlusIcon size={24} color="#666666" />
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
                            <TouchableOpacity style={chatViewStyles.micButton}>
                                <MicrophoneIcon size={24} color="#666666" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>

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
