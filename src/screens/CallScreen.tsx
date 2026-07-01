import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, Alert, Image, Dimensions, DeviceEventEmitter, ScrollView, Keyboard, type DimensionValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    LiveKitRoom,
    useTracks,
    VideoTrack,
    registerGlobals,
    useLocalParticipant,
    useRoomContext,
    useParticipants,
} from '@livekit/react-native';

// Initialize WebRTC
registerGlobals();
import { Track, RoomEvent, ConnectionState, type RemoteParticipant } from 'livekit-client';
import { Audio } from 'expo-av';
import { API_URL } from '../config/api.config';
import { CameraIcon, MicrophoneIcon, PhoneIcon, SyncIcon } from '../components/icons/NavigationIcons';
import { chatService } from '../services/chat.service';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../contexts/AuthContext';
import { saveMessage, deleteMessage, updateConversationPreview } from '../database/chatDatabase';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from '../components/UpgradeModal';
import { supabase } from '../lib/supabase';
import { callKeepService } from '../services/callkeep.service';

type LayoutMode = 'grid' | 'interpreter';

type TranscriptCaption = {
    id: string;
    speaker: string;
    text: string;
};

type PartialCaption = {
    speaker: string;
    text: string;
};

/**
 * Colores bien diferenciados sobre fondo oscuro (nombre = un color estable por hash).
 * Tonos saturados para que se note la diferencia entre personas.
 */
const SPEAKER_NAME_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#FFE066',
    '#A78BFA',
    '#FF8FAB',
    '#74C0FC',
    '#8CE99A',
    '#FFB347',
    '#E599F7',
    '#66D9E8',
    '#FFD43B',
    '#FF8787',
];

function colorForSpeakerName(name: string): string {
    const key = name.trim().toLowerCase() || '_';
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return SPEAKER_NAME_COLORS[Math.abs(h) % SPEAKER_NAME_COLORS.length];
}

function asOptionalString(value: unknown): string | undefined {
    if (value == null) return undefined;
    const text = String(value);
    return text.length > 0 ? text : undefined;
}

function getCallSessionIdFromPayload(payload: any): string | undefined {
    return asOptionalString(
        payload?.callSessionId ||
        payload?.call_session_id ||
        payload?.metadata?.callSessionId ||
        payload?.metadata?.call_session_id
    );
}

function broadcastCallEndedToChat(
    conversationId: string,
    senderId: string,
    messageId: string,
    createdAt: string,
    roomName?: string,
    callSessionId?: string,
) {
    const channel = supabase.channel(`chat:${conversationId.toLowerCase()}`);
    let sent = false;

    const cleanup = () => {
        void supabase.removeChannel(channel);
    };

    const timeout = setTimeout(cleanup, 2500);

    channel.subscribe(async (status) => {
        console.log('[CALL_DEBUG] CallScreen.broadcastCallEnded.subscribe', {
            status,
            sent,
            conversationId,
            senderId,
            messageId,
            createdAt,
            roomName,
            callSessionId,
        });

        if (status !== 'SUBSCRIBED' || sent) return;
        sent = true;
        clearTimeout(timeout);

        try {
            console.log('[CALL_DEBUG] CallScreen.broadcastCallEnded.send', {
                conversationId,
                senderId,
                messageId,
                createdAt,
                roomName,
                callSessionId,
            });
            await channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: {
                    id: messageId,
                    conversationId,
                    senderId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    createdAt,
                    conversation_id: conversationId,
                    sender_id: senderId,
                    created_at: createdAt,
                    isMine: false,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                },
            });
        } catch (error) {
            console.warn('Could not broadcast call_ended fast path:', error);
        } finally {
            cleanup();
        }
    });
}

export interface CallScreenProps {
    roomName: string;
    username: string;
    conversationId?: string;
    userId?: string;
    callSessionId?: string;
    onBack: () => void;
    isManualPipMode?: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
    onNavigate?: (screen: string, params?: any) => void;
    isIncomingCall?: boolean;
}

import { CallState } from '../lib/callState';

export const CallScreen = ({
    roomName,
    username,
    conversationId,
    userId,
    callSessionId,
    onBack,
    isManualPipMode = false,
    onRestoreFromPip,
    onMinimize,
    onNavigate,
    isIncomingCall = false
}: CallScreenProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [roomRenderKey, setRoomRenderKey] = useState(0);
    const [isRoomConnected, setIsRoomConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const hasExitedRef = useRef(false);
    const hasConnectedRef = useRef(false);
    const reconnectAttemptsRef = useRef(0);

    useEffect(() => {
        Keyboard.dismiss();
        CallState.isInsideCallScreen = true;
        return () => {
            CallState.isInsideCallScreen = false;
            // Garantizar que la llamada nativa muera cuando salimos de la pantalla (evita que se quede atascada)
            try {
                callKeepService.endAllCallsSilently();
            } catch (e) {
                console.warn('[CallScreen] Error ending native call on unmount:', e);
            }
        };
    }, []);

    useEffect(() => {
        Keyboard.dismiss();
    }, [roomName, callSessionId]);

    const safeOnBack = useCallback(() => {
        if (hasExitedRef.current) return;
        hasExitedRef.current = true;
        onBack();
    }, [onBack]);

    const retryRoomConnection = useCallback(() => {
        setConnectionError(null);
        setIsRoomConnected(false);
        hasConnectedRef.current = false;
        reconnectAttemptsRef.current = 0;
        setRoomRenderKey((value) => value + 1);
    }, []);

    const handleRoomConnected = useCallback(() => {
        console.log('[CALL_DEBUG] LiveKit connected.', { roomName, conversationId, callSessionId });
        hasConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        setConnectionError(null);
        setIsRoomConnected(true);
    }, [roomName, conversationId, callSessionId]);

    const handleRoomDisconnected = useCallback(() => {
        console.log('[CALL_DEBUG] LiveKit disconnected.', {
            roomName,
            conversationId,
            callSessionId,
            hasExited: hasExitedRef.current,
            hadConnected: hasConnectedRef.current,
            reconnectAttempts: reconnectAttemptsRef.current,
        });

        setIsRoomConnected(false);

        if (hasExitedRef.current) return;

        if (!hasConnectedRef.current && reconnectAttemptsRef.current < 2) {
            reconnectAttemptsRef.current += 1;
            setRoomRenderKey((value) => value + 1);
            return;
        }

        if (!hasConnectedRef.current) {
            setConnectionError('No se pudo conectar la llamada. Intent? de nuevo.');
        }
    }, [roomName, conversationId, callSessionId]);

    const handleRoomError = useCallback((error: Error) => {
        console.error('[CALL_DEBUG] LiveKit connection error:', error);
        setIsRoomConnected(false);

        if (hasExitedRef.current) return;

        if (!hasConnectedRef.current && reconnectAttemptsRef.current < 2) {
            reconnectAttemptsRef.current += 1;
            setRoomRenderKey((value) => value + 1);
            return;
        }

        setConnectionError('No se pudo conectar la llamada. Intent? de nuevo.');
    }, []);

    // FAST BROADCAST LISTENER
    // Escucha directamente en el canal del chat para recibir el rechazo de la llamada a la velocidad de la luz
    useEffect(() => {
        if (!conversationId || !userId) return;

        const channel = supabase.channel(`chat:${conversationId.toLowerCase()}`)
            .on('broadcast', { event: 'call_ended' }, (payload) => {
                const data = payload.payload;
                const eventCallSessionId = getCallSessionIdFromPayload(data);

                if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                    console.log('[CALL_DEBUG] Ignoring stale call_ended broadcast for different session.', {
                        currentCallSessionId: callSessionId,
                        eventCallSessionId,
                        conversationId,
                        roomName,
                    });
                    return;
                }

                if (data.senderId !== userId && (data.roomName === roomName || data.conversationId === conversationId)) {
                    console.log('[CALL_DEBUG] Fast Broadcast remote call end detected, terminating local call...');
                    safeOnBack();
                }
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [conversationId, roomName, userId, callSessionId, safeOnBack]);

    const handleCallTimeout = useCallback(() => {
        console.log('Call timed out after 30s. Disconnecting...');
        if (conversationId && userId) {
            // 1. Optimistic Local Save for Instant UI Feedback
            const tempId = `call_${Date.now()}`;
            const now = new Date().toISOString();
            
            saveMessage({
                id: tempId,
                serverId: tempId,
                conversationId,
                senderId: userId,
                content: 'Llamada perdida',
                type: 'call_missed',
                status: 'pending',
                createdAt: now,
                updatedAt: now,
                isMine: true,
                metadata: {
                    roomName,
                    callSessionId,
                },
            });
            
            // AVISO RÁPIDO PARA LIMPIAR PANTALLA RECEPTOR
            broadcastCallEndedToChat(conversationId, userId, tempId, now, roomName, callSessionId);

            DeviceEventEmitter.emit('chat_local_update', conversationId);
            updateConversationPreview(conversationId, 'Llamada perdida', now, false);
            DeviceEventEmitter.emit('conversations_updated');

            // 2. Network Sync
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada perdida',
                type: 'call_missed',
                metadata: {
                    roomName,
                    callSessionId,
                },
            }).then(({ message: serverMsg }) => {
                deleteMessage(tempId);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: serverMsg.content,
                    type: serverMsg.type,
                    status: 'sent',
                    createdAt: serverMsg.createdAt,
                    updatedAt: (serverMsg as any).updatedAt || now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                DeviceEventEmitter.emit('chat_local_update', conversationId);
            }).catch(e => {
                console.log('Error sending timeout message:', e);
            });
        }
        safeOnBack();
    }, [conversationId, userId, roomName, callSessionId, safeOnBack]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('CallKeep_EndCall', (data) => {
            if (!data?.wasInsideCallScreen || isRoomConnected) return;

            const eventCallSessionId = getCallSessionIdFromPayload(data);
            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                return;
            }

            const eventConversationId = asOptionalString(data?.conversationId || data?.conversation_id);
            const eventRoomName = asOptionalString(data?.roomName || data?.room_name);
            const eventCallUUID = asOptionalString(data?.callUUID || data?.call_uuid);
            const hasRoutingData = Boolean(eventConversationId || eventRoomName || eventCallUUID);
            const matchesConversation = Boolean(eventConversationId && conversationId && eventConversationId.toLowerCase() === conversationId.toLowerCase());
            const matchesRoom = Boolean(eventRoomName && eventRoomName === roomName);
            const matchesUUID = Boolean(eventCallUUID && (eventCallUUID === roomName || eventCallUUID === conversationId));

            if (hasRoutingData && !matchesConversation && !matchesRoom && !matchesUUID) return;

            console.log('[CALL_DEBUG] Native CallKeep end while CallScreen is connecting; ending app call.');
            if (conversationId && userId) {
                const tempId = `call_native_end_${Date.now()}`;
                const now = new Date().toISOString();

                saveMessage({
                    id: tempId,
                    serverId: tempId,
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    status: 'pending',
                    createdAt: now,
                    updatedAt: now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                broadcastCallEndedToChat(conversationId, userId, tempId, now, roomName, callSessionId);
                DeviceEventEmitter.emit('chat_local_update', conversationId);
                updateConversationPreview(conversationId, 'Llamada finalizada', now, false);
                DeviceEventEmitter.emit('conversations_updated');

                chatService.sendMessage({
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                }).then(({ message: serverMsg }) => {
                    deleteMessage(tempId);
                    saveMessage({
                        id: serverMsg.id,
                        serverId: serverMsg.id,
                        conversationId,
                        senderId: userId,
                        content: 'Llamada finalizada',
                        type: 'call_ended',
                        status: 'sent',
                        createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || now,
                        updatedAt: now,
                        isMine: true,
                        metadata: {
                            roomName,
                            callSessionId,
                        },
                    });
                    DeviceEventEmitter.emit('chat_local_update', conversationId);
                }).catch(e => console.log('Could not send native call_ended message:', e));
            }

            safeOnBack();
        });

        return () => sub.remove();
    }, [isRoomConnected, conversationId, userId, roomName, callSessionId, safeOnBack]);

    // Listen for remote call rejections/hang-ups
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('external_call_ended', (data) => {
            const eventCallSessionId = getCallSessionIdFromPayload(data);

            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                console.log('[CALL_DEBUG] Ignoring stale external_call_ended for different session.', {
                    currentCallSessionId: callSessionId,
                    eventCallSessionId,
                    conversationId,
                    roomName,
                });
                return;
            }

            if (data.conversationId === conversationId || data.roomName === roomName) {
                console.log('[CALL_DEBUG] Remote call end detected, terminating local call...');
                safeOnBack();
            }
        });
        return () => sub.remove();
    }, [conversationId, roomName, callSessionId, safeOnBack]);

    useEffect(() => {
        if (!conversationId) return;

        const activeCallChannel = supabase.channel(`active-call:${conversationId.toLowerCase()}`);

        activeCallChannel
            .on('broadcast', { event: 'new_message' }, (payload) => {
                const message = payload.payload as {
                    type?: string;
                    conversationId?: string;
                    conversation_id?: string;
                    senderId?: string;
                    sender_id?: string;
                    callSessionId?: string;
                    call_session_id?: string;
                    metadata?: { roomName?: string; callSessionId?: string; call_session_id?: string };
                    isGroup?: boolean | string;
                };

                const messageType = asOptionalString(message?.type);
                if (!messageType || !['call_ended', 'call_rejected', 'call_missed'].includes(messageType)) {
                    return;
                }

                // If it's a group call, one person rejecting the call doesn't mean the call ends for everyone.
                const isGroup = message?.isGroup === true || message?.isGroup === 'true';
                if (messageType === 'call_rejected' && isGroup) {
                    return;
                }

                const messageConversationId = asOptionalString(message?.conversationId || message?.conversation_id);
                const messageSenderId = asOptionalString(message?.senderId || message?.sender_id);
                const messageRoomName = asOptionalString(message?.metadata?.roomName);
                const messageCallSessionId = getCallSessionIdFromPayload(message);

                if (callSessionId && messageCallSessionId && messageCallSessionId !== callSessionId) {
                    console.log('[CALL_DEBUG] Ignoring stale terminal call event for different session.', {
                        conversationId,
                        roomName,
                        messageType,
                        currentCallSessionId: callSessionId,
                        messageCallSessionId,
                    });
                    return;
                }

                const matchesConversation = messageConversationId?.toLowerCase() === conversationId.toLowerCase();
                const matchesRoom = messageRoomName === roomName;

                if ((!matchesConversation && !matchesRoom) || (userId && messageSenderId === userId)) {
                    return;
                }

                console.log('[CALL_DEBUG] Remote terminal call event received via chat broadcast, closing immediately.', {
                    conversationId,
                    roomName,
                    messageType,
                    messageConversationId,
                    messageSenderId,
                    messageRoomName,
                });
                safeOnBack();
            })
            .subscribe();

        return () => {
            void supabase.removeChannel(activeCallChannel);
        };
    }, [conversationId, roomName, userId, callSessionId, safeOnBack]);

    // Do not save a generic call_ended marker on every unmount.
    // Hangup and remote-end flows already emit/persist terminal events; doing it here
    // creates duplicate call_ended rows and makes call-card matching noisy.

    // Apaga el agente Vosk en Model-ms al salir de la llamada (evita procesos colgados en active_agents).
    useEffect(() => {
        return () => {
            chatService.stopTranscription(roomName).catch(() => undefined);
        };
    }, [roomName]);

    useEffect(() => {
        let isMounted = true;
        hasExitedRef.current = false;
        setToken(null);
        setUrl(null);
        setIsRoomConnected(false);
        setConnectionError(null);
        hasConnectedRef.current = false;
        reconnectAttemptsRef.current = 0;
        setRoomRenderKey((value) => value + 1);

        const prepareSession = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });

                const data = await apiClient<{ token: string; url: string }>('/calls/token', {
                    method: 'POST',
                    body: JSON.stringify({ roomName, username }),
                });

                if (data.token && isMounted) {
                    setToken(data.token);

                    if (typeof data.url === 'string' && data.url.startsWith('wss://')) {
                        setUrl(data.url);
                    } else {
                        console.error('❌ Backend did not provide a valid LiveKit URL. Connection failed.');
                        Alert.alert('Error', 'No se pudo configurar la conexión de video. Contacte a soporte.');
                    }
                }
            } catch (e) {
                console.error('Failed to setup call', e);
            }
        };

        prepareSession();

        return () => { isMounted = false; };
    }, [roomName, username, callSessionId]);

    if (connectionError) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>{connectionError}</Text>
                <View style={styles.connectionActions}>
                    <TouchableOpacity style={styles.retryButton} onPress={retryRoomConnection}>
                        <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.retryButton, styles.exitButton]} onPress={safeOnBack}>
                        <Text style={styles.retryButtonText}>Salir</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!token || !url) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.text}>Conectando...</Text>
                <TouchableOpacity style={[styles.loadingHangupButton, { marginTop: 24 }]} onPress={safeOnBack}>
                    <PhoneIcon size={28} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <LiveKitRoom
                key={`${roomName}-${roomRenderKey}`}
                serverUrl={url}
                token={token}
                connect={true}
                options={{ adaptiveStream: true }}
                audio={true}
                video={true}
                onConnected={handleRoomConnected}
                onDisconnected={handleRoomDisconnected}
                onError={handleRoomError}
            >
                {!isRoomConnected ? (
                    <View style={styles.connectingOverlay}>
                        <ActivityIndicator size="large" color="#7C3AED" />
                        <Text style={styles.text}>Conectando a la sala...</Text>
                        <TouchableOpacity style={[styles.loadingHangupButton, { marginTop: 24 }]} onPress={safeOnBack}>
                            <PhoneIcon size={28} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <RingingSoundManager onTimeout={handleCallTimeout} />
                        <VideoView layoutMode={layoutMode} isFrontCamera={isFrontCamera} />
                        <ControlsView
                            onHangup={safeOnBack}
                            conversationId={conversationId}
                            userId={userId}
                            callSessionId={callSessionId}
                            roomName={roomName}
                            username={username}
                            layoutMode={layoutMode}
                            onToggleLayout={() => setLayoutMode(m => m === 'grid' ? 'interpreter' : 'grid')}
                            onToggleCameraFacing={() => setIsFrontCamera(prev => !prev)}
                            isFrontCamera={isFrontCamera}
                            isManualPipMode={isManualPipMode}
                            onRestoreFromPip={onRestoreFromPip}
                            onMinimize={onMinimize}
                            onBack={onBack}
                            onNavigate={onNavigate}
                        />
                        <RoomEvents onLeave={safeOnBack} />
                    </>
                )}
            </LiveKitRoom>
        </View>
    );
};

function payloadToUint8Array(payload: Uint8Array | ArrayBuffer | undefined): Uint8Array | null {
    if (payload == null) return null;
    if (payload instanceof Uint8Array) return payload;
    return new Uint8Array(payload);
}

function ParticipantTranscriptionOverlay({ participantIdentity, bottomOffset = 30 }: { participantIdentity: string, bottomOffset?: number }) {
    const room = useRoomContext();
    const [isLivekitConnected, setIsLivekitConnected] = useState(false);
    const [finalLines, setFinalLines] = useState<TranscriptCaption[]>([]);
    const [partialLine, setPartialLine] = useState<PartialCaption | null>(null);
    const scrollRef = useRef<ScrollView>(null);
    const captionIdRef = useRef(0);

    // Auto-scroll to bottom when new text arrives
    useEffect(() => {
        if (scrollRef.current) {
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [finalLines, partialLine]);

    // En React Native suele no existir `window`; hooks como useDataChannel no suscriben el observable y no reciben datos.
    useEffect(() => {
        if (!room) return;

        const syncConnected = () => {
            setIsLivekitConnected(room.state === ConnectionState.Connected);
        };
        syncConnected();

        const onDataReceived = (
            payload: Uint8Array,
            participant?: RemoteParticipant,
            _kind?: unknown,
            _topic?: string,
        ) => {
            const bytes = payloadToUint8Array(payload);
            if (!bytes || bytes.byteLength === 0) return;
            try {
                // Decodificación robusta para React Native (UTF-8)
                const str = decodeURIComponent(
                    Array.from(bytes)
                        .map(b => '%' + ('00' + b.toString(16)).slice(-2))
                        .join('')
                );

                const data = JSON.parse(str) as {
                    type?: string;
                    text?: string;
                    isFinal?: boolean;
                    speakerId?: string;
                };

                if (data.type !== 'transcription' || typeof data.text !== 'string') return;
                const trimmed = data.text.trim();
                if (!trimmed) return;

                const rawSpeaker = data.speakerId || participant?.identity || '';

                // Only process transcription if it matches this participant
                if (rawSpeaker !== participantIdentity) return;

                // Clean up identity labels (transcriber-room-identity)
                const speaker = rawSpeaker
                    .replace(/^transcriber-[^-]+-?/i, '')
                    .replace(/^transcriber-/i, '')
                    .split('-')[0] || 'AI';

                if (data.isFinal === true) {
                    captionIdRef.current += 1;
                    const id = `cc-${captionIdRef.current}`;
                    setFinalLines((prev) => [
                        ...prev.slice(-8),
                        { id, speaker, text: trimmed },
                    ]);
                    setPartialLine(null);
                } else {
                    setPartialLine({ speaker, text: trimmed });
                }
            } catch (err) {
                console.log('Error parsing transcription packet:', err);
            }
        };

        room.on(RoomEvent.ConnectionStateChanged, syncConnected);
        room.on(RoomEvent.DataReceived, onDataReceived);

        return () => {
            room.off(RoomEvent.ConnectionStateChanged, syncConnected);
            room.off(RoomEvent.DataReceived, onDataReceived);
        };
    }, [room]);

    if (!isLivekitConnected) return null;

    const hasContent = finalLines.length > 0 || !!partialLine;
    // Sin texto aún: no mostrar caja ni "esperando…" (menos invasivo).
    if (!hasContent) return null;

    return (
        <View style={[styles.participantTranscriptionContainer, { bottom: bottomOffset }]} pointerEvents="none">
            <View style={styles.participantTranscriptionBox}>
                <ScrollView
                    ref={scrollRef}
                    style={styles.transcriptionScroll}
                    contentContainerStyle={styles.transcriptionScrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {finalLines.map((line) => (
                        <Text key={line.id} style={styles.transcriptionLineFinal}>
                            <Text style={styles.transcriptionUtterance}>{line.text}</Text>
                        </Text>
                    ))}
                    {partialLine ? (
                        <Text style={styles.transcriptionLinePartial}>
                            <Text style={styles.transcriptionUtterancePartial}>{partialLine.text}</Text>
                        </Text>
                    ) : null}
                </ScrollView>
            </View>
        </View>
    );
}

function RoomEvents({ onLeave }: { onLeave: () => void }) {
    const room = useRoomContext();

    useEffect(() => {
        if (!room) return;

        const onParticipantDisconnected = (participant: RemoteParticipant) => {
            if (!participant) return;

            const isAgent = participant.isAgent ||
                participant.identity.toLowerCase().includes('agent') ||
                participant.identity.toLowerCase().includes('bot') ||
                participant.identity.toLowerCase().includes('transcriber');

            if (isAgent) return;

            let remoteHumanCount = 0;
            room.remoteParticipants.forEach((p) => {
                if (!p.isAgent && !p.identity.toLowerCase().includes('agent') && !p.identity.toLowerCase().includes('bot') && !p.identity.toLowerCase().includes('transcriber')) {
                    remoteHumanCount++;
                }
            });

            if (remoteHumanCount === 0) {
                onLeave();
            }
        };

        room.on('participantDisconnected', onParticipantDisconnected);

        return () => {
            room.off('participantDisconnected', onParticipantDisconnected);
        };
    }, [room, onLeave]);

    return null;
}

function RingingSoundManager({ onTimeout }: { onTimeout?: () => void }) {
    const participants = useParticipants();
    const room = useRoomContext();
    const soundRef = useRef<Audio.Sound | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Keep a fresh reference to onTimeout to avoid re-triggering effects or stale closures
    const onTimeoutRef = useRef(onTimeout);
    useEffect(() => {
        onTimeoutRef.current = onTimeout;
    }, [onTimeout]);

    const humanCount = participants.filter(p => !p.identity.toLowerCase().startsWith('transcriber-')).length;

    useEffect(() => {
        let isMounted = true;

        const playSound = async () => {
            try {
                // If only local participant is in the room, play dialing sound
                if (humanCount <= 1) {
                    if (!timeoutRef.current) {
                        timeoutRef.current = setTimeout(() => {
                            if (onTimeoutRef.current) {
                                room.disconnect().catch(e => console.error('Error disconnecting room on timeout:', e));
                                onTimeoutRef.current();
                            }
                        }, 30000);
                    }

                    if (!soundRef.current) {
                        const { sound } = await Audio.Sound.createAsync(
                            require('../../assets/ringing.wav'),
                            { shouldPlay: true, isLooping: true }
                        );
                        if (isMounted) {
                            soundRef.current = sound;
                        } else {
                            sound.unloadAsync();
                        }
                    }
                } else {
                    // Someone joined, stop ringing
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current);
                        timeoutRef.current = null;
                    }
                    if (soundRef.current) {
                        await soundRef.current.stopAsync();
                        await soundRef.current.unloadAsync();
                        soundRef.current = null;
                    }
                }
            } catch (error) {
                console.log('Error managing ringing sound', error);
            }
        };

        playSound();

        return () => {
            isMounted = false;
        };
    }, [humanCount, room]);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.stopAsync();
                soundRef.current.unloadAsync();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return null;
}

function VideoView({ layoutMode, isFrontCamera }: { layoutMode: LayoutMode, isFrontCamera: boolean }) {
    const tracks = useTracks([Track.Source.Camera]);
    const { height: screenHeight } = Dimensions.get('window');
    const insets = useSafeAreaInsets();

    const isInterpreter = (identity: string) => {
        return identity.toLowerCase().includes('interp') || identity.toLowerCase().includes('intérp');
    };

    const interpreterTracks = tracks.filter(t => isInterpreter(t.participant.identity));
    const otherTracks = tracks.filter(t => !isInterpreter(t.participant.identity));

    const renderParticipant = (track: typeof tracks[number], width: DimensionValue, height: DimensionValue, isBottomRow: boolean = true) => {
        // Use percentage-based offsets relative to the tile height so labels
        // render consistently across devices regardless of screen size / density.
        const numericHeight = typeof height === 'number' ? height : undefined;
        // The controls container takes up ~100px + insets.bottom. 
        // We position the label safely above it using absolute math so they never cross.
        const labelBottom = isBottomRow
            ? Math.max(110 + insets.bottom, numericHeight ? numericHeight * 0.18 : 110)
            : 8;
        const transcriptionBottom = isBottomRow
            ? Math.max(140 + insets.bottom, numericHeight ? numericHeight * 0.25 : 140)
            : 40;

        return (
            <View key={track.participant.identity} style={[styles.participant, { width, height }]}>
                {track.publication.isMuted ? (
                    <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: '#666' }}>{track.participant.identity}</Text>
                    </View>
                ) : (
                    <VideoTrack
                        trackRef={track}
                        style={styles.video}
                        mirror={track.participant.isLocal && isFrontCamera}
                    />
                )}
                <View style={[styles.participantLabel, { bottom: labelBottom }]}>
                    <Text style={styles.participantName} numberOfLines={1}>
                        {track.participant.identity}
                    </Text>
                </View>
                <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={transcriptionBottom} />
            </View>
        );
    };

    if (layoutMode === 'grid' || interpreterTracks.length === 0) {
        const count = tracks.length;

        if (count <= 1) {
            return (
                <View style={styles.videoGrid}>
                    {tracks.map(t => renderParticipant(t, '100%', '100%', true))}
                </View>
            );
        }

        if (count === 2) {
            return (
                <View style={styles.videoGrid}>
                    {tracks.map((t, index) => renderParticipant(t, '100%', '50%', index === 1))}
                </View>
            );
        }

        if (count === 3) {
            return (
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', height: '50%' }}>
                        {renderParticipant(tracks[0], '50%', '100%', false)}
                        {renderParticipant(tracks[1], '50%', '100%', false)}
                    </View>
                    <View style={{ height: '50%' }}>
                        {renderParticipant(tracks[2], '100%', '100%', true)}
                    </View>
                </View>
            );
        }

        // 4+ participants: 2-column grid
        const cols = 2;
        const rows = Math.ceil(count / cols);
        const tileW: DimensionValue = `${100 / cols}%`;
        const tileH: DimensionValue = `${100 / rows}%`;

        return (
            <View style={styles.videoGrid}>
                {tracks.map((t, index) => {
                    const isBottomRow = index >= (rows - 1) * cols;
                    return renderParticipant(t, tileW, tileH, isBottomRow);
                })}
            </View>
        );
    }

    return (
        <View style={styles.interpreterLayout}>
            <View style={styles.mainVideoArea}>
                {interpreterTracks.length > 0 ? (
                    interpreterTracks.map((track) => (
                        <View key={track.participant.identity} style={styles.mainParticipant}>
                            {track.publication.isMuted ? (
                                <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Text style={{ color: '#666', fontSize: 18 }}>🤟 Intérprete - Cámara off</Text>
                                </View>
                            ) : (
                                <VideoTrack
                                    trackRef={track}
                                    style={styles.video}
                                    mirror={track.participant.isLocal && isFrontCamera}
                                />
                            )}
                            <View style={[styles.interpreterMainLabel, { bottom: Math.max(110 + insets.bottom, screenHeight * 0.12) }]}>
                                <Text style={styles.interpreterMainName}>🤟 Intérprete</Text>
                            </View>
                            <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={Math.max(140 + insets.bottom, screenHeight * 0.20)} />
                        </View>
                    ))
                ) : (
                    <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ color: '#666' }}>Esperando intérprete...</Text>
                    </View>
                )}
            </View>

            <View style={styles.participantsSidebar}>
                {otherTracks.map((track) => (
                    <View key={track.participant.identity} style={styles.sidebarVideo}>
                        {track.publication.isMuted ? (
                            <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#666', fontSize: 10 }}>{track.participant.identity}</Text>
                            </View>
                        ) : (
                            <VideoTrack
                                trackRef={track}
                                style={styles.video}
                                mirror={track.participant.isLocal && isFrontCamera}
                            />
                        )}
                        <View style={styles.sidebarLabel}>
                            <Text style={styles.sidebarName} numberOfLines={1}>
                                {track.participant.identity}
                            </Text>
                        </View>
                        <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={35} />
                    </View>
                ))}
            </View>
        </View>
    );
}

function ControlsView({
    onHangup,
    conversationId,
    userId,
    callSessionId,
    roomName,
    username,
    layoutMode,
    onToggleLayout,
    onToggleCameraFacing,
    isFrontCamera,
    isManualPipMode,
    onRestoreFromPip,
    onMinimize,
    onBack,
    onNavigate
}: {
    onHangup: () => void;
    conversationId?: string;
    userId?: string;
    callSessionId?: string;
    roomName: string;
    username: string;
    layoutMode: LayoutMode;
    onToggleLayout: () => void;
    onToggleCameraFacing: () => void;
    isFrontCamera: boolean;
    isManualPipMode: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
    onBack: () => void;
    onNavigate?: (screen: string, params?: any) => void;
}) {
    const { user } = useAuth();
    const { isMicrophoneEnabled, isCameraEnabled, localParticipant, cameraTrack } = useLocalParticipant();
    const room = useRoomContext();
    const { canUseInterpreter } = useSubscription(userId);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const insets = useSafeAreaInsets();

    const toggleMic = async () => {
        const enabled = !isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(enabled);
    };

    const toggleCam = async () => {
        const enabled = !isCameraEnabled;
        await localParticipant.setCameraEnabled(enabled);
    };

    const flipCamera = async () => {
        try {
            const track = cameraTrack?.videoTrack as any;
            if (track && typeof track.restartTrack === 'function') {
                const newFacingMode = isFrontCamera ? 'environment' : 'user';
                await track.restartTrack({ facingMode: newFacingMode });
                onToggleCameraFacing();
            } else {
                console.error('No camera track or restartTrack available to switch');
            }
        } catch (e) {
            console.error('Error switching camera:', e);
        }
    };

    const handleDisconnect = useCallback(() => {
        console.log('[CALL_DEBUG] CallScreen.handleDisconnect.start', {
            conversationId,
            userId,
            roomName,
            callSessionId,
        });

        // Disconnect immediately to avoid UI hang
        if (room) {
            room.disconnect().catch(e => console.error('Error disconnecting room:', e));
        }
        onHangup();

        // Perform side-effects in the background
        if (conversationId && userId) {
            const tempId = `call_${Date.now()}`;
            const now = new Date().toISOString();

            // Fetch the latest call to ensure our marker is strictly newer than the call message
            const localMsgs = require('../database/chatDatabase').getMessages(conversationId);
            const latestCall = localMsgs.find((m: any) => m.type === 'call');
            let markerTime = Date.now();
            if (latestCall && latestCall.createdAt) {
                const callTimeMs = new Date(latestCall.createdAt.replace(' ', 'T')).getTime();
                if (markerTime <= callTimeMs) {
                    markerTime = callTimeMs + 1000;
                }
            }
            const markerDateStr = new Date(markerTime).toISOString();
            console.log('[CALL_DEBUG] CallScreen.handleDisconnect.marker', {
                tempId,
                conversationId,
                userId,
                roomName,
                callSessionId,
                latestCallId: latestCall?.id,
                latestCallCreatedAt: latestCall?.createdAt,
                markerDateStr,
            });

            // 1. Optimistic Local Save — caller's chat updates instantly
            saveMessage({
                id: tempId,
                serverId: tempId,
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                status: 'pending',
                createdAt: markerDateStr,
                updatedAt: markerDateStr,
                isMine: true,
                metadata: {
                    roomName,
                    callSessionId,
                },
            });
            broadcastCallEndedToChat(conversationId, userId, tempId, markerDateStr, roomName, callSessionId);
            DeviceEventEmitter.emit('chat_local_update', conversationId);
            updateConversationPreview(conversationId, 'Llamada finalizada', now, false);
            DeviceEventEmitter.emit('conversations_updated');

            // 2. SLOW PATH — API call for server persistence (creates the DB record)
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                metadata: {
                    roomName,
                    callSessionId,
                },
            }).then(({ message: serverMsg }) => {
                deleteMessage(tempId);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: 'Llamada finalizada',
                    type: 'call_ended',
                    status: 'sent',
                    createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || now,
                    updatedAt: now,
                    isMine: true,
                    metadata: {
                        roomName,
                        callSessionId,
                    },
                });
                DeviceEventEmitter.emit('chat_local_update', conversationId);
            }).catch(e => console.log('Could not send call_ended message:', e));
        }

        if (user?.role === 'interpreter' && user.id) {
            chatService.updateInterpreterStatus(user.id, false)
                .catch(e => console.error('Error updating interpreter status:', e));
        }
    }, [room, onHangup, conversationId, userId, roomName, callSessionId, user?.role, user?.id]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('CallKeep_EndCall', (data) => {
            if (!data?.wasInsideCallScreen) return;

            const eventCallSessionId = getCallSessionIdFromPayload(data);
            if (callSessionId && eventCallSessionId && eventCallSessionId !== callSessionId) {
                console.log('[CALL_DEBUG] Ignoring native end for different call session.', {
                    currentCallSessionId: callSessionId,
                    eventCallSessionId,
                    conversationId,
                    roomName,
                });
                return;
            }

            const eventConversationId = asOptionalString(data?.conversationId || data?.conversation_id);
            const eventRoomName = asOptionalString(data?.roomName || data?.room_name);
            const eventCallUUID = asOptionalString(data?.callUUID || data?.call_uuid);
            const hasRoutingData = Boolean(eventConversationId || eventRoomName || eventCallUUID);
            const matchesConversation = Boolean(eventConversationId && conversationId && eventConversationId.toLowerCase() === conversationId.toLowerCase());
            const matchesRoom = Boolean(eventRoomName && eventRoomName === roomName);
            const matchesUUID = Boolean(eventCallUUID && (eventCallUUID === roomName || eventCallUUID === conversationId));

            if (hasRoutingData && !matchesConversation && !matchesRoom && !matchesUUID) {
                console.log('[CALL_DEBUG] Ignoring native end for unrelated call.', {
                    eventConversationId,
                    eventRoomName,
                    eventCallUUID,
                    conversationId,
                    roomName,
                });
                return;
            }

            console.log('[CALL_DEBUG] Native CallKeep end matched active CallScreen; hanging up app call.');
            handleDisconnect();
        });

        return () => sub.remove();
    }, [conversationId, roomName, callSessionId, handleDisconnect]);

    const handleInviteInterpreters = async () => {
        if (!userId) return;

        if (!canUseInterpreter) {
            setShowUpgradeModal(true);
            return;
        }

        try {
            Alert.alert(
                'Solicitar Intérprete',
                '¿Desea solicitar un intérprete para unirse a esta llamada?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Solicitar',
                        onPress: async () => {
                            try {
                                const result = await chatService.inviteInterpreters({
                                    roomName,
                                    userId,
                                    username
                                });
                                if (result.success) {
                                    Alert.alert('Solicitud enviada', `Se ha notificado a ${result.count || 1} intérprete(s).`);
                                } else {
                                    Alert.alert('Info', result.message || 'No se pudo completar la solicitud.');
                                }
                            } catch (error) {
                                console.error('Error initiating invite:', error);
                                Alert.alert('Error', 'Hubo un error al solicitar intérprete.');
                            }
                        }
                    }
                ]
            );
        } catch (e) {
            console.error('Invite error', e);
        }
    };

    return (
        <>
            {isManualPipMode && (
                <TouchableOpacity
                    style={[styles.pipRestoreButton, { top: Math.max(insets.top + 10, 20) }]}
                    onPress={onRestoreFromPip}
                >
                    <Text style={{ fontSize: 24 }}>↗️</Text>
                </TouchableOpacity>
            )}

            <View style={[
                styles.controlsContainer,
                { paddingBottom: Math.max(insets.bottom, 10) + 16 },
                !isManualPipMode && {
                    left: -insets.left,
                    right: -insets.right,
                    paddingHorizontal: 20 + Math.max(insets.left, insets.right),
                },
                isManualPipMode && styles.controlsContainerMini
            ]}>
                <TouchableOpacity
                    style={[styles.button, !isMicrophoneEnabled && styles.buttonDisabled]}
                    onPress={toggleMic}
                >
                    <MicrophoneIcon size={24} color={isMicrophoneEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: '#fff' }]}
                    onPress={handleInviteInterpreters}
                >
                    <Image
                        source={require('../../assets/icon.png')}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.hangupButton]}
                    onPress={handleDisconnect}
                >
                    <PhoneIcon size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, !isCameraEnabled && styles.buttonDisabled]}
                    onPress={toggleCam}
                >
                    <CameraIcon size={24} color={isCameraEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, !isCameraEnabled && styles.buttonDisabled]}
                    onPress={flipCamera}
                >
                    <SyncIcon size={24} color={isCameraEnabled ? '#000' : '#fff'} />
                </TouchableOpacity>
            </View>

            {/* Imported Modal Component for feature lock */}
            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="interpreter"
                onUpgradePress={() => {
                    setShowUpgradeModal(false);
                    // Defer the back and navigate to avoid crash from unmounting CallScreen while navigating
                    setTimeout(() => {
                        onBack();
                        if (onNavigate) {
                            onNavigate('profile', { openManagePlan: true });
                        }
                    }, 50);
                }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: 'white',
        marginTop: 10,
    },
    connectionActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 24,
    },
    retryButton: {
        backgroundColor: '#7C3AED',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
    },
    exitButton: {
        backgroundColor: '#374151',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    loadingHangupButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#dc2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    connectingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
    },
    videoGrid: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    participant: {
        position: 'relative',
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    participantLabel: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    participantName: {
        color: '#fff',
        fontSize: 12,
    },
    interpreterLayout: {
        flex: 1,
        flexDirection: 'row',
    },
    mainVideoArea: {
        flex: 1,
    },
    mainParticipant: {
        flex: 1,
        position: 'relative',
    },
    interpreterMainLabel: {
        position: 'absolute',
        left: 16,
        right: 16,
        backgroundColor: 'rgba(124, 58, 237, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
    },
    interpreterMainName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    participantsSidebar: {
        width: 120,
        backgroundColor: '#0a0a0a',
        borderLeftWidth: 2,
        borderLeftColor: '#333',
    },
    sidebarVideo: {
        height: 160,
        position: 'relative',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    sidebarLabel: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        alignItems: 'center',
    },
    sidebarName: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '500',
    },
    interpreterSidebar: {
        width: 130,
        backgroundColor: '#1a1a1a',
        borderLeftWidth: 2,
        borderLeftColor: '#7C3AED',
    },
    interpreterVideo: {
        flex: 1,
        position: 'relative',
    },
    interpreterLabel: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        right: 4,
        backgroundColor: 'rgba(124, 58, 237, 0.8)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        alignItems: 'center',
    },
    interpreterName: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    layoutToggleButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: 10,
    },
    layoutToggleText: {
        fontSize: 16,
    },
    layoutToggleLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(15, 15, 20, 0.85)',
        paddingTop: 16,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        zIndex: 50,
    },
    button: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        backgroundColor: '#ef4444',
    },
    hangupButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#dc2626',
    },
    pipRestoreButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    minimizeButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.7)',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    controlsContainerMini: {
        bottom: 10,
        transform: [{ scale: 0.8 }],
    },
    participantTranscriptionContainer: {
        position: 'absolute',
        left: 8,
        right: 8,
        alignItems: 'center',
        zIndex: 100,
    },
    participantTranscriptionBox: {
        backgroundColor: 'rgba(6, 6, 10, 0.65)',
        paddingHorizontal: 6,
        paddingTop: 3,
        paddingBottom: 3,
        borderRadius: 5,
        width: '100%',
        maxHeight: 50,
    },
    ccBadge: {
        position: 'absolute',
        top: -6,
        left: 4,
        backgroundColor: '#cc0000',
        paddingHorizontal: 3,
        paddingVertical: 1,
        borderRadius: 3,
        zIndex: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    ccBadgeText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    transcriptionScroll: {
        maxHeight: 45,
    },
    transcriptionScrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingRight: 2,
    },
    transcriptionLineFinal: {
        textAlign: 'left',
        marginBottom: 2,
        lineHeight: 14,
    },
    transcriptionSpeakerName: {
        color: 'rgba(255, 255, 255, 0.65)',
        fontSize: 9,
        fontWeight: '800',
    },
    transcriptionSpeakerColon: {
        color: 'rgba(255, 255, 255, 0.42)',
        fontSize: 9,
        fontWeight: '600',
    },
    transcriptionUtterance: {
        color: 'rgba(248, 248, 248, 0.96)',
        fontSize: 11,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.65)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
    },
    transcriptionLinePartial: {
        textAlign: 'left',
        lineHeight: 14,
        marginTop: 0,
    },
    transcriptionUtterancePartial: {
        color: 'rgba(220, 220, 220, 0.82)',
        fontSize: 11,
        fontWeight: '400',
        fontStyle: 'italic',
    },
});
