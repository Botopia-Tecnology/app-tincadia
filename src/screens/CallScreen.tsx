import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, SafeAreaView, Alert, Image, Dimensions } from 'react-native';
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
import { Track } from 'livekit-client';
import { Audio } from 'expo-av';
import { API_URL } from '../config/api.config';
import { CameraIcon, MicrophoneIcon, PhoneIcon } from '../components/icons/NavigationIcons';
import { chatService } from '../services/chat.service';
import { useAuth } from '../contexts/AuthContext';

type LayoutMode = 'grid' | 'interpreter';

export interface CallScreenProps {
    roomName: string;
    username: string;
    conversationId?: string;
    userId?: string;
    onBack: () => void;
    isManualPipMode?: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
}

export const CallScreen = ({ 
    roomName, 
    username, 
    conversationId, 
    userId, 
    onBack,
    isManualPipMode = false,
    onRestoreFromPip,
    onMinimize
}: CallScreenProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');

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
                    setUrl('wss://tincadia-azanv2gh.livekit.cloud');
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
                onDisconnected={onBack}
            >
                <VideoView layoutMode={layoutMode} />
                <ControlsView
                    onHangup={onBack}
                    conversationId={conversationId}
                    userId={userId}
                    roomName={roomName}
                    username={username}
                    layoutMode={layoutMode}
                    onToggleLayout={() => setLayoutMode(m => m === 'grid' ? 'interpreter' : 'grid')}
                    isManualPipMode={isManualPipMode}
                    onRestoreFromPip={onRestoreFromPip}
                    onMinimize={onMinimize}
                />
                <RoomEvents onLeave={onBack} />
            </LiveKitRoom>
        </View>
    );
};

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

function VideoView({ layoutMode }: { layoutMode: LayoutMode }) {
    const tracks = useTracks([Track.Source.Camera]);
    const participants = useParticipants();
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    const isInterpreter = (identity: string) => {
        return identity.toLowerCase().includes('interp') || identity.toLowerCase().includes('intérp');
    };

    const interpreterTracks = tracks.filter(t => isInterpreter(t.participant.identity));
    const otherTracks = tracks.filter(t => !isInterpreter(t.participant.identity));

    if (layoutMode === 'grid' || interpreterTracks.length === 0) {
        return (
            <View style={styles.videoGrid}>
                {tracks.map((track) => (
                    <View key={track.participant.identity} style={styles.participant}>
                        {track.publication.isMuted ? (
                            <View style={[styles.video, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#666' }}>{track.participant.identity}</Text>
                            </View>
                        ) : (
                            <VideoTrack
                                trackRef={track}
                                style={styles.video}
                            />
                        )}
                        <View style={styles.participantLabel}>
                            <Text style={styles.participantName} numberOfLines={1}>
                                {track.participant.identity}
                            </Text>
                        </View>
                    </View>
                ))}
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
                                />
                            )}
                            <View style={styles.interpreterMainLabel}>
                                <Text style={styles.interpreterMainName}>🤟 Intérprete</Text>
                            </View>
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
                            />
                        )}
                        <View style={styles.sidebarLabel}>
                            <Text style={styles.sidebarName} numberOfLines={1}>
                                {track.participant.identity}
                            </Text>
                        </View>
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
    isManualPipMode: boolean;
    onRestoreFromPip?: () => void;
    onMinimize?: () => void;
}) {
    const { user } = useAuth();
    const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
    const room = useRoomContext();

    const toggleMic = async () => {
        const enabled = !isMicrophoneEnabled;
        await localParticipant.setMicrophoneEnabled(enabled);
    };

    const toggleCam = async () => {
        const enabled = !isCameraEnabled;
        await localParticipant.setCameraEnabled(enabled);
    };

    const handleDisconnect = async () => {
        if (conversationId && userId) {
            try {
                await chatService.sendMessage({
                    conversationId,
                    senderId: userId,
                    content: '📞 Llamada finalizada',
                    type: 'call_ended'
                });
            } catch (e) {
                console.log('Could not send call_ended message:', e);
            }
        }

        if (user?.role === 'interpreter' && user.id) {
            try {
                await chatService.updateInterpreterStatus(user.id, false);
            } catch (e) {
                console.error('Error updating interpreter status:', e);
            }
        }

        if (room) {
            await room.disconnect();
        }
        onHangup();
    };

    const handleInviteInterpreters = async () => {
        if (!userId) return;

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
                    style={styles.pipRestoreButton}
                    onPress={onRestoreFromPip}
                >
                    <Text style={{ fontSize: 24 }}>↗️</Text>
                </TouchableOpacity>
            )}

            {!isManualPipMode && (
                <TouchableOpacity
                    style={styles.minimizeButton}
                    onPress={onMinimize}
                >
                    <Text style={{ fontSize: 20 }}>🔽</Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                style={styles.layoutToggleButton}
                onPress={onToggleLayout}
            >
                <Text style={styles.layoutToggleText}>
                    {layoutMode === 'grid' ? '⬜' : '📱'}
                </Text>
                <Text style={styles.layoutToggleLabel}>
                    {layoutMode === 'grid' ? 'Intérprete' : 'Cuadrícula'}
                </Text>
            </TouchableOpacity>

            <View style={[styles.controlsContainer, isManualPipMode && styles.controlsContainerMini]}>
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
            </View>
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
    },
    participant: {
        flex: 1,
        position: 'relative',
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
    }
});
