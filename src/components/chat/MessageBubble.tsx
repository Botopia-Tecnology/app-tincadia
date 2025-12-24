import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Modal, Dimensions, StyleSheet, Pressable } from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { messageBubbleStyles as styles } from '../../styles/ChatComponents.styles';
import { mediaService } from '../../services/media.service';
import { Ionicons } from '@expo/vector-icons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
    isRead?: boolean;
    type?: string;
}

export function MessageBubble({ content, time, isMine, isSynced = true, isRead = false, type = 'text' }: MessageBubbleProps) {
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
    const [showFullscreen, setShowFullscreen] = useState(false);

    // Auto-load media when component mounts
    useEffect(() => {
        let isMounted = true;

        const loadMedia = async () => {
            if ((type === 'image' || type === 'video' || type === 'audio') && content) {
                // If it's already a full URL or local file
                if (content.startsWith('http') || content.startsWith('file://')) {
                    setMediaUri(content);
                    return;
                }

                // It's a storage key - get the public URL
                setIsLoading(true);
                try {
                    const uri = await mediaService.downloadMedia(content);
                    if (isMounted) {
                        setMediaUri(uri);
                    }
                } catch (e) {
                    console.error('Failed to load media:', e);
                } finally {
                    if (isMounted) {
                        setIsLoading(false);
                    }
                }
            }
        };

        loadMedia();

        return () => {
            isMounted = false;
            if (audioSound) {
                audioSound.unloadAsync();
            }
        };
    }, [content, type]);

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

    // Regular text message
    if (type === 'text' || type === 'call' || type === 'call_ended') {
        return (
            <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.content, isMine ? styles.contentMine : styles.contentOther]}>
                        {content}
                    </Text>
                    <View style={styles.footer}>
                        <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
                            {formatTime(time)}
                        </Text>
                        {renderCheckmarks()}
                    </View>
                </View>
            </View>
        );
    }

    // Media message (image/video/audio)
    return (
        <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, { padding: 4 }]}>
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
