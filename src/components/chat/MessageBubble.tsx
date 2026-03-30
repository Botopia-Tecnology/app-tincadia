import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Modal, Dimensions, StyleSheet, Pressable, Vibration } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { messageBubbleStyles as styles } from '../../styles/ChatComponents.styles';
import { Ionicons } from '@expo/vector-icons';
import { mediaService } from '../../services/media.service';
import Autolink from 'react-native-autolink';
import { API_URL } from '../../config/api.config';
import { apiClient } from '../../lib/api-client';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
    isRead?: boolean;
    type?: 'text' | 'image' | 'video' | 'audio' | 'call' | 'call_ended';
    replyToContent?: string;
    replyToSender?: string;
    publicId?: string;
    duration?: number; // New prop for audio duration in seconds
    senderName?: string;
}

export function MessageBubble({
    content,
    time,
    isMine,
    isSynced = true,
    isRead = false,
    type = 'text',
    replyToContent,
    replyToSender,
    publicId,
    duration,
    senderName
}: MessageBubbleProps) {
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [audioDuration, setAudioDuration] = useState<number | null>(null);

    // Auto-load media when component mounts
    useEffect(() => {
        const loadMedia = async () => {
            if ((type === 'image' || type === 'video' || type === 'audio') && content) {
                // 1. If it's a local file (e.g. pending upload), use it immediately
                if (content.startsWith('file://')) {
                    setMediaUri(content);
                    return;
                }

                setIsLoading(true);
                try {
                    const normalizeUrl = (url: string) => {
                        if (url.startsWith('http')) return url;
                        return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                    };

                    // 2. Try to get media through the caching service
                    // We prefer publicId for signed URLs, but fall back to content URL
                    const storageKeyOrUrl = publicId || normalizeUrl(content);
                    const localUri = await mediaService.downloadMedia(storageKeyOrUrl, type as 'image' | 'video' | 'audio');
                    
                    if (localUri) {
                        setMediaUri(localUri);
                    } else {
                        // Final fallback if caching fails
                        setMediaUri(normalizeUrl(content));
                    }
                } catch (e) {
                    console.error('Failed to load/cache media:', e);
                    // Minimal fallback
                    if (!content.startsWith('http')) {
                        setMediaUri(`${API_URL}${content.startsWith('/') ? '' : '/'}${content}`);
                    } else {
                        setMediaUri(content);
                    }
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadMedia();
    }, [content, type, publicId]);

    // Extract audio duration when mediaUri is available
    useEffect(() => {
        const loadAudioDuration = async () => {
            if (type === 'audio' && mediaUri && audioDuration === null) {
                try {
                    const { sound, status } = await Audio.Sound.createAsync(
                        { uri: mediaUri },
                        { shouldPlay: false }
                    );
                    if (status.isLoaded && status.durationMillis) {
                        setAudioDuration(status.durationMillis / 1000);
                    }
                    await sound.unloadAsync();
                } catch (e) {
                    console.error('Failed to get audio duration:', e);
                }
            }
        };
        loadAudioDuration();
    }, [type, mediaUri, audioDuration]);

    const handlePlayAudio = async () => {
        if (!mediaUri) return;

        if (isPlaying && audioSound) {
            await audioSound.pauseAsync();
            setIsPlaying(false);
            return;
        }

        try {
            if (audioSound) {
                await audioSound.playAsync();
            } else {
                const { sound } = await Audio.Sound.createAsync({ uri: mediaUri });
                setAudioSound(sound);
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlaying(false);
                        // Optional: seek to start?
                    }
                });
                await sound.playAsync();
            }
            setIsPlaying(true);
        } catch (e) {
            console.error('Audio playback error:', e);
        }
    };

    const formatTime = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [ttsSound, setTtsSound] = useState<Audio.Sound | null>(null);

    const handleSpeak = async () => {
        if (isSpeaking) {
            // Stop playback if already speaking
            if (ttsSound) {
                await ttsSound.stopAsync();
                await ttsSound.unloadAsync();
                setTtsSound(null);
            }
            setIsSpeaking(false);
            return;
        }

        try {
            setIsSpeaking(true);
            Vibration.vibrate(40);

            const result = await apiClient<{ success: boolean; audioUrl: string }>('/model/tts', {
                method: 'POST',
                body: JSON.stringify({ text: content }),
            });

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

    // Helper to format duration
    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderCheckmarks = () => {
        if (!isMine) return null;

        if (!isSynced) {
            return <Text style={styles.pending}>⏳</Text>;
        }

        const checkmarkColor = isRead ? '#34B7F1' : 'rgba(255, 255, 255, 0.6)';
        return (
            <Text style={[styles.checkmarks, { color: checkmarkColor }]}>
                ✓✓
            </Text>
        );
    };

    const renderMedia = () => {
        if (isLoading) {
            return (
                <View style={mediaStyles.placeholder}>
                    <ActivityIndicator color={isMine ? 'white' : 'gray'} />
                </View>
            );
        }

        if (!mediaUri) {
            return (
                <View style={mediaStyles.placeholder}>
                    <Ionicons name="image-outline" size={32} color={isMine ? 'white' : 'gray'} />
                </View>
            );
        }

        if (type === 'image') {
            return (
                <TouchableOpacity onPress={() => setShowFullscreen(true)} activeOpacity={0.9}>
                    <Image
                        source={{ uri: mediaUri }}
                        style={mediaStyles.thumbnail}
                        resizeMode="cover"
                    />
                </TouchableOpacity>
            );
        }

        if (type === 'video') {
            return (
                <Video
                    source={{ uri: mediaUri }}
                    style={mediaStyles.thumbnail}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                />
            );
        }

        if (type === 'audio') {
            // Use extracted duration, fallback to prop
            const displayDuration = audioDuration ?? duration;
            return (
                <TouchableOpacity onPress={handlePlayAudio} style={mediaStyles.audio}>
                    <Ionicons
                        name={isPlaying ? 'pause-circle' : 'play-circle'}
                        size={36}
                        color={isMine ? 'white' : '#4CAF50'}
                    />
                    <View style={mediaStyles.audioWave}>
                        {[...Array(10)].map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    mediaStyles.audioBar,
                                    {
                                        height: 4 + Math.random() * 12,
                                        backgroundColor: isMine ? 'rgba(255,255,255,0.6)' : 'rgba(76,175,80,0.6)',
                                    },
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={{
                        color: isMine ? 'rgba(255,255,255,0.8)' : '#666',
                        fontSize: 11,
                        marginLeft: 8,
                        alignSelf: 'flex-end',
                        marginBottom: 4
                    }}>
                        {displayDuration ? formatDuration(displayDuration) : '--:--'}
                    </Text>
                </TouchableOpacity>
            );
        }

        return null;
    };

    // Fullscreen image modal
    const renderFullscreenModal = () => (
        <Modal visible={showFullscreen} transparent animationType="fade">
            <Pressable style={mediaStyles.modalBackdrop} onPress={() => setShowFullscreen(false)}>
                <View style={mediaStyles.modalContent}>
                    <Image
                        source={{ uri: mediaUri! }}
                        style={mediaStyles.fullscreenImage}
                        resizeMode="contain"
                    />
                    <TouchableOpacity
                        style={mediaStyles.closeButton}
                        onPress={() => setShowFullscreen(false)}
                    >
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );

    // Render reply quote if present
    const renderReplyQuote = () => {
        if (!replyToContent || !replyToSender) return null;
        return (
            <View style={{
                backgroundColor: isMine ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)',
                borderLeftWidth: 3,
                borderLeftColor: '#4F46E5',
                borderRadius: 4,
                padding: 6,
                marginBottom: 4,
            }}>
                <Text style={{
                    color: '#4F46E5',
                    fontSize: 11,
                    fontWeight: '600',
                    marginBottom: 2
                }}>
                    {replyToSender}
                </Text>
                <Text
                    numberOfLines={2}
                    style={{
                        color: isMine ? 'rgba(255,255,255,0.8)' : '#666',
                        fontSize: 12
                    }}
                >
                    {replyToContent}
                </Text>
            </View>
        );
    };

    // Regular text message
    if (type === 'text' || type === 'call' || type === 'call_ended') {
        return (
            <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                {senderName && (
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#4CAF50', marginBottom: 2 }}>{senderName}</Text>
                )}
                {renderReplyQuote()}
                    <Autolink
                        text={content}
                        email
                        url
                        stripPrefix={false}
                        selectable={true}
                        linkStyle={{ textDecorationLine: 'underline', color: isMine ? 'white' : '#4F46E5', fontWeight: 'bold' }}
                        style={[styles.content, isMine ? styles.contentMine : styles.contentOther]}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        <TouchableOpacity 
                            onPress={handleSpeak} 
                            style={[{ padding: 4 }, isSpeaking && { opacity: 0.5 }]}
                            disabled={isSpeaking}
                        >
                            <Ionicons name={isSpeaking ? "volume-high" : "volume-medium-outline"} size={16} color={isMine ? 'rgba(255,255,255,0.7)' : '#4F46E5'} />
                        </TouchableOpacity>
                        <View style={styles.footer}>
                            <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
                                {formatTime(time)}
                            </Text>
                            {renderCheckmarks()}
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // Media message (image/video/audio)
    return (
        <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, { padding: 4 }]}>
                {renderReplyQuote()}
                {renderMedia()}
                <View style={[styles.footer, { paddingHorizontal: 8, paddingBottom: 4 }]}>
                    <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
                        {formatTime(time)}
                    </Text>
                    {renderCheckmarks()}
                </View>
            </View>
            {type === 'image' && renderFullscreenModal()}
        </View>
    );
}

const mediaStyles = StyleSheet.create({
    placeholder: {
        width: 200,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 10,
    },
    thumbnail: {
        width: 200,
        height: 150,
        borderRadius: 10,
    },
    audio: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 180,
    },
    audioWave: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
        gap: 2,
    },
    audioBar: {
        width: 3,
        borderRadius: 2,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.8,
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
