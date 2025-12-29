import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import {
    LiveKitRoom,
    useTracks,
    VideoTrack,
    registerGlobals,
    useLocalParticipant,
    useRoomContext,
} from '@livekit/react-native';

// Initialize WebRTC
registerGlobals();
import { Track } from 'livekit-client';
import { Audio } from 'expo-av';
import { API_URL } from '../config/api.config';
import { CameraIcon, MicrophoneIcon, PhoneIcon } from '../components/icons/NavigationIcons';
import { chatService } from '../services/chat.service';

interface CallScreenProps {
    roomName: string;
    username: string;
    conversationId?: string;
    userId?: string;
    onBack: () => void;
}

export const CallScreen = ({ roomName, username, conversationId, userId, onBack }: CallScreenProps) => {
    const [token, setToken] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);

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
                <VideoView />
                <ControlsView
                    onHangup={onBack}
                    conversationId={conversationId}
                    userId={userId}
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
            // If it's a 1-on-1 call and the other person leaves, end the call
            // We check total participants in the room
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

function VideoView() {
    const tracks = useTracks([Track.Source.Camera]);

    return (
        <View style={styles.videoGrid}>
            {tracks.map((track) => (
                <View key={track.participant.identity} style={styles.participant}>
                    {track.publication.isMuted ? (
                        <View style={[styles.video, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                            {/* Optional: Add an icon or text indicating camera is off */}
                        </View>
                    ) : (
                        <VideoTrack
                            trackRef={track}
                            style={styles.video}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}

function ControlsView({ onHangup, conversationId, userId }: {
    onHangup: () => void;
    conversationId?: string;
    userId?: string;
}) {
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
        // Send call_ended message to the conversation
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

        if (room) {
            await room.disconnect();
        }
        onHangup();
    };

    return (
        <View style={styles.controlsContainer}>
            <TouchableOpacity
                style={[styles.button, !isMicrophoneEnabled && styles.buttonDisabled]}
                onPress={toggleMic}
            >
                <MicrophoneIcon size={24} color={isMicrophoneEnabled ? '#000' : '#fff'} />
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
    },
    video: {
        width: '100%',
        height: '100%',
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
        backgroundColor: '#ef4444', // Red for disabled
    },
    hangupButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#dc2626', // Red for hangup
    }
});
