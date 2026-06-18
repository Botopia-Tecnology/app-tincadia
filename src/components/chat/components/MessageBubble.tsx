import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Modal, Pressable, Vibration, Linking, Dimensions } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { messageBubbleStyles as styles } from '../../../styles/ChatComponents.styles';
import { messageBubbleMediaStyles as mediaStyles } from '../../../styles/ChatComponents.styles';
import { Ionicons } from '@expo/vector-icons';
import { mediaService } from '../../../services/media.service';
import Autolink from 'react-native-autolink';
import { API_URL } from '../../../config/api.config';
import { apiClient } from '../../../lib/api-client';
import { MessageMetadata } from '../../../types/chat.types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

/**
 * Clave para descarga / URL firmada: evita tratar un public_id de Cloudinary como ruta del API
 * (eso devolvía HTML/JSON y ExoPlayer lanzaba UnrecognizedInputFormatException).
 */
function resolveChatMediaKey(publicId: string | undefined, content: string, apiBase: string): string {
    if (publicId) return publicId;
    if (!content) return '';
    if (content.startsWith('file://')) return content;
    if (content.startsWith('http://') || content.startsWith('https://')) return content;
    if (content.startsWith('/')) {
        return `${apiBase}${content}`;
    }
    return content;
}

const SENDER_COLORS = [
    '#4CAF50', '#E91E63', '#9C27B0', '#FF9800',
    '#00BCD4', '#3F51B5', '#FF5722', '#009688',
    '#795548', '#607D8B', '#F44336', '#2196F3',
];

function getSenderColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
    isRead?: boolean;
    type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'call' | 'call_ended' | 'call_rejected' | 'call_missed';
    replyToContent?: string;
    replyToSender?: string;
    publicId?: string;
    duration?: number;
    senderName?: string;
    updatedAt?: string;
    readAt?: string;
    metadata?: MessageMetadata;
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
    senderName,
    updatedAt,
    readAt,
    metadata,
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
            if ((type === 'image' || type === 'video' || type === 'audio' || type === 'document') && content) {
                // 1. If it's a local file (e.g. pending upload), use it immediately
                if (content.startsWith('file://')) {
                    setMediaUri(content);
                    return;
                }

                setIsLoading(true);
                const normalizeUrl = (url: string) => {
                    if (url.startsWith('http')) return url;
                    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                };
                
                try {

                    const resolvedKey = resolveChatMediaKey(publicId, content, API_URL);
                    const localUri = await mediaService.downloadMedia(resolvedKey, type as 'image' | 'video' | 'audio');

                    if (localUri) {
                        setMediaUri(localUri);
                    } else {
                        const playable =
                            resolvedKey.startsWith('http') || resolvedKey.startsWith('file://');
                        setMediaUri(playable ? resolvedKey : normalizeUrl(content));
                    }
                } catch (e) {
                    console.error('Failed to load/cache media:', e);
                    const key = resolveChatMediaKey(publicId, content, API_URL);
                    setMediaUri(key.startsWith('http') || key.startsWith('file://') ? key : normalizeUrl(content));
                } finally {
                    setIsLoading(false);
                }
            }
        };
        loadMedia();
    }, [content, type, publicId]);

    // Memoize audio wave heights to prevent jitter on re-renders
    const audioWaveHeights = useMemo(() => {
        return [...Array(10)].map(() => 4 + Math.random() * 12);
    }, []);

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

    // Detener audio nativo si el componente se desmonta (e.g. scroll en lista)
    useEffect(() => {
        return () => {
            if (isSpeaking) {
                Speech.stop();
            }
        };
    }, [isSpeaking]);

    const handleSpeak = async () => {
        if (isSpeaking) {
            // Stop playback if already speaking
            Speech.stop();
            setIsSpeaking(false);
            return;
        }

        try {
            setIsSpeaking(true);
            Vibration.vibrate(40);

            Speech.speak(content, {
                language: 'es-ES',
                onDone: () => setIsSpeaking(false),
                onStopped: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
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

    const isDeleted = content === 'Mensaje eliminado' || content === '🚫 Mensaje eliminado' || updatedAt?.includes('deleted');
    const isEdited = !isDeleted && (() => {
        if (type !== 'text') return false; // Media messages NEVER show "(editado)"
        if (metadata?.wasEdited === true) return true;
        if (!updatedAt || !time) return false;
        const createdMs = new Date(time).getTime();
        const updatedMs = new Date(updatedAt).getTime();
        if (updatedMs <= createdMs + 2000) return false;
        if (readAt) {
            const readMs = new Date(readAt).getTime();
            if (Math.abs(updatedMs - readMs) < 5000) return false;
        }
        return true;
    })();

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
                        {audioWaveHeights.map((height, i) => (
                            <View
                                key={i}
                                style={[
                                    mediaStyles.audioBar,
                                    {
                                        height: height,
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

        if (type === 'document') {
            const fileName = metadata?.fileName || 'Documento adjunto';
            const handleOpenDocument = () => {
                if (mediaUri) {
                    Linking.openURL(mediaUri).catch(() => {
                        console.error('Could not open document:', mediaUri);
                    });
                }
            };

            return (
                <TouchableOpacity onPress={handleOpenDocument} style={mediaStyles.document}>
                    <View style={mediaStyles.documentIconContainer}>
                        <Ionicons name="document-text" size={32} color={isMine ? 'white' : '#4F46E5'} />
                    </View>
                    <View style={mediaStyles.documentTextContainer}>
                        <Text style={[mediaStyles.documentName, { color: isMine ? 'white' : '#333' }]} numberOfLines={1}>
                            {fileName}
                        </Text>
                        <Text style={[mediaStyles.documentSubtext, { color: isMine ? 'rgba(255,255,255,0.7)' : '#666' }]}>
                            Tocar para abrir
                        </Text>
                    </View>
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

    // Render reply quote if present (hide for deleted messages)
    const renderReplyQuote = () => {
        if (!replyToContent || !replyToSender || isDeleted) return null;
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

    const senderColor = senderName ? getSenderColor(senderName) : '#4CAF50';

    // Actividad de grupo (salida, expulsión, grupo creado, etc.)
    if (metadata?.isSystem === true && type === 'text') {
        return (
            <View style={{ alignSelf: 'center', maxWidth: '92%', marginVertical: 8, paddingHorizontal: 12 }}>
                <Text
                    style={{
                        fontSize: 12,
                        color: '#8E8E93',
                        textAlign: 'center',
                        lineHeight: 17,
                    }}
                >
                    {content}
                </Text>
                <Text
                    style={{
                        fontSize: 10,
                        color: '#AEAEB2',
                        textAlign: 'center',
                        marginTop: 4,
                    }}
                >
                    {formatTime(time)}
                </Text>
            </View>
        );
    }

    // Regular text message or any deleted message
    if (isDeleted || type === 'text' || type === 'call' || type === 'call_ended' || type === 'call_rejected' || type === 'call_missed') {
        return (
            <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                {senderName && (
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: senderColor, marginBottom: 2 }}>{senderName}</Text>
                )}
                {renderReplyQuote()}
                    {isDeleted ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="close-circle-outline" size={15} color={isMine ? 'rgba(255,255,255,0.5)' : '#999'} />
                            <Text style={[
                                styles.content,
                                isMine ? styles.contentMine : styles.contentOther,
                                { fontStyle: 'italic', opacity: 0.6 }
                            ]}>
                                Mensaje eliminado
                            </Text>
                        </View>
                    ) : (
                        <Autolink
                            text={content}
                            email
                            url
                            stripPrefix={false}
                            selectable
                            linkStyle={{ textDecorationLine: 'underline', color: isMine ? 'white' : '#4F46E5', fontWeight: 'bold' }}
                            style={[styles.content, isMine ? styles.contentMine : styles.contentOther]}
                        />
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                        {!isDeleted ? (
                            <TouchableOpacity 
                                onPress={handleSpeak} 
                                style={[{ padding: 4 }, isSpeaking && { opacity: 0.3 }]}
                                disabled={isSpeaking}
                            >
                                <Ionicons name={isSpeaking ? "volume-high" : "volume-medium-outline"} size={16} color={isMine ? 'rgba(255,255,255,0.7)' : '#4F46E5'} />
                            </TouchableOpacity>
                        ) : <View />}
                        <View style={styles.footer}>
                            {isEdited && (
                                <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther, { marginRight: 4, fontStyle: 'italic' }]}>
                                    (editado)
                                </Text>
                            )}
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
                {senderName && (
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: senderColor, marginBottom: 2, paddingHorizontal: 4, paddingTop: 4 }}>{senderName}</Text>
                )}
                {renderReplyQuote()}
                {renderMedia()}
                <View style={[styles.footer, { paddingHorizontal: 8, paddingBottom: 4 }]}>
                    {isEdited && (
                        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther, { marginRight: 4, fontStyle: 'italic' }]}>
                            (editado)
                        </Text>
                    )}
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

