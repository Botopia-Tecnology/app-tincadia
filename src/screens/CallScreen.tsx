import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, Alert, Image, Dimensions, DeviceEventEmitter, ScrollView } from 'react-native';
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
import { useAuth } from '../contexts/AuthContext';
import { saveMessage, deleteMessage } from '../database/chatDatabase';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from '../components/UpgradeModal';

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

export interface CallScreenProps {
    roomName: string;
    username: string;
    conversationId?: string;
    userId?: string;
    onBack: () => void;
    isManualPipMode?: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
    onNavigate?: (screen: string, params?: any) => void;
}

export const CallScreen = ({ 
    roomName, 
    username, 
    conversationId, 
    userId, 
    onBack,
    isManualPipMode = false,
    onRestoreFromPip,
    onMinimize,
    onNavigate
}: CallScreenProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const hasExitedRef = useRef(false);

    const safeOnBack = useCallback(() => {
        if (hasExitedRef.current) return;
        hasExitedRef.current = true;
        onBack();
    }, [onBack]);

    // Listen for remote call rejections/hang-ups
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('external_call_ended', (data) => {
            if (data.conversationId === conversationId || data.roomName === roomName) {
                console.log('📱 Remote call end detected, terminating local call...');
                safeOnBack();
            }
        });
        return () => sub.remove();
    }, [conversationId, roomName, safeOnBack]);

    // Apaga el agente Vosk en Model-ms al salir de la llamada (evita procesos colgados en active_agents).
    useEffect(() => {
        return () => {
            chatService.stopTranscription(roomName).catch(() => undefined);
        };
    }, [roomName]);

    useEffect(() => {
        let isMounted = true;

        const prepareSession = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });

                const response = await fetch(`${API_URL}/calls/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomName, username }),
                });

                const data = await response.json();

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
    }, [roomName, username]);

    if (!token || !url) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.text}>Conectando...</Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <LiveKitRoom
                serverUrl={url}
                token={token}
                connect={true}
                options={{ adaptiveStream: true }}
                audio={true}
                video={true}
                onDisconnected={safeOnBack}
            >
                <RingingSoundManager />
                <VideoView layoutMode={layoutMode} isFrontCamera={isFrontCamera} />
                <ControlsView
                    onHangup={safeOnBack}
                    conversationId={conversationId}
                    userId={userId}
                    roomName={roomName}
                    username={username}
                    layoutMode={layoutMode}
                    onToggleLayout={() => setLayoutMode(m => m === 'grid' ? 'interpreter' : 'grid')}
                    onToggleCameraFacing={() => setIsFrontCamera(prev => !prev)}
                    isFrontCamera={isFrontCamera}
                    isManualPipMode={isManualPipMode}
                    onRestoreFromPip={onRestoreFromPip}
                    onMinimize={onMinimize}
                />
                <RoomEvents onLeave={safeOnBack} />
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

        const onParticipantDisconnected = () => {
            if (room.numParticipants <= 1) {
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

function RingingSoundManager() {
    const participants = useParticipants();
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        let isMounted = true;

        const playSound = async () => {
            try {
                // If only local participant is in the room, play dialing sound
                if (participants.length <= 1) {
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
    }, [participants.length]);

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.stopAsync();
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    return null;
}

function VideoView({ layoutMode, isFrontCamera }: { layoutMode: LayoutMode, isFrontCamera: boolean }) {
    const tracks = useTracks([Track.Source.Camera]);
    const participants = useParticipants();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const isInterpreter = (identity: string) => {
        return identity.toLowerCase().includes('interp') || identity.toLowerCase().includes('intérp');
    };

    const interpreterTracks = tracks.filter(t => isInterpreter(t.participant.identity));
    const otherTracks = tracks.filter(t => !isInterpreter(t.participant.identity));

    const renderParticipant = (track: typeof tracks[number], width: number, height: number) => (
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
            <View style={styles.participantLabel}>
                <Text style={styles.participantName} numberOfLines={1}>
                    {track.participant.identity}
                </Text>
            </View>
            <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={35} />
        </View>
    );

    if (layoutMode === 'grid' || interpreterTracks.length === 0) {
        const count = tracks.length;

        if (count <= 1) {
            return (
                <View style={styles.videoGrid}>
                    {tracks.map(t => renderParticipant(t, screenWidth, screenHeight))}
                </View>
            );
        }

        if (count === 2) {
            const halfH = screenHeight / 2;
            return (
                <View style={styles.videoGrid}>
                    {tracks.map(t => renderParticipant(t, screenWidth, halfH))}
                </View>
            );
        }

        if (count === 3) {
            const halfW = screenWidth / 2;
            const halfH = screenHeight / 2;
            return (
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', height: halfH }}>
                        {renderParticipant(tracks[0], halfW, halfH)}
                        {renderParticipant(tracks[1], halfW, halfH)}
                    </View>
                    <View style={{ height: halfH }}>
                        {renderParticipant(tracks[2], screenWidth, halfH)}
                    </View>
                </View>
            );
        }

        // 4+ participants: 2-column grid
        const cols = 2;
        const rows = Math.ceil(count / cols);
        const tileW = screenWidth / cols;
        const tileH = screenHeight / rows;

        return (
            <View style={styles.videoGrid}>
                {tracks.map(t => renderParticipant(t, tileW, tileH))}
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
                            <View style={styles.interpreterMainLabel}>
                                <Text style={styles.interpreterMainName}>🤟 Intérprete</Text>
                            </View>
                            <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={130} />
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
                        <ParticipantTranscriptionOverlay participantIdentity={track.participant.identity} bottomOffset={25} />
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
    roomName, 
    username, 
    layoutMode, 
    onToggleLayout,
    onToggleCameraFacing,
    isFrontCamera,
    isManualPipMode,
    onRestoreFromPip,
    onMinimize
}: {
    onHangup: () => void;
    conversationId?: string;
    userId?: string;
    roomName: string;
    username: string;
    layoutMode: LayoutMode;
    onToggleLayout: () => void;
    onToggleCameraFacing: () => void;
    isFrontCamera: boolean;
    isManualPipMode: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
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

    const handleDisconnect = () => {
        // Disconnect immediately to avoid UI hang
        if (room) {
            room.disconnect().catch(e => console.error('Error disconnecting room:', e));
        }
        onHangup();

        // Perform side-effects in the background
        if (conversationId && userId) {
            // 1. Optimistic Local Save for Instant UI Feedback
            const tempId = `call_${Date.now()}`;
            saveMessage({
                id: tempId,
                serverId: tempId,
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                type: 'call_ended',
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                isMine: true
            });
            DeviceEventEmitter.emit('chat_local_update', conversationId);

            // 2. Network Sync
            chatService.sendMessage({
                conversationId,
                senderId: userId,
                content: 'Llamada finalizada',
                    type: 'call_ended'
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
                    createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isMine: true
                });
                DeviceEventEmitter.emit('chat_local_update', conversationId);
            }).catch(e => console.log('Could not send call_ended message:', e));
        }

        if (user?.role === 'interpreter' && user.id) {
            chatService.updateInterpreterStatus(user.id, false)
                .catch(e => console.error('Error updating interpreter status:', e));
        }
    };

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
                { bottom: 40 + Math.max(insets.bottom, 10) }, 
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
                    onBack();
                    onNavigate?.('profile', { openManagePlan: true });
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
        bottom: 80,
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
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 20,
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
        paddingHorizontal: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: 8,
        width: '100%',
        maxHeight: 70,
    },
    ccBadge: {
        position: 'absolute',
        top: 4,
        right: 6,
        backgroundColor: 'rgba(124, 58, 237, 0.38)',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        zIndex: 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    ccBadgeText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    transcriptionScroll: {
        maxHeight: 58,
    },
    transcriptionScrollContent: {
        flexGrow: 1,
        justifyContent: 'flex-end',
        paddingRight: 2,
    },
    transcriptionLineFinal: {
        textAlign: 'left',
        marginBottom: 5,
        lineHeight: 15,
    },
    transcriptionSpeakerName: {
        fontSize: 10,
        fontWeight: '800',
    },
    transcriptionSpeakerColon: {
        color: 'rgba(255, 255, 255, 0.42)',
        fontSize: 10,
        fontWeight: '600',
    },
    transcriptionUtterance: {
        color: 'rgba(248, 248, 248, 0.96)',
        fontSize: 11,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    transcriptionLinePartial: {
        textAlign: 'left',
        lineHeight: 15,
        marginTop: 1,
    },
    transcriptionUtterancePartial: {
        color: 'rgba(220, 220, 220, 0.82)',
        fontSize: 11,
        fontWeight: '500',
        fontStyle: 'italic',
    },
});
