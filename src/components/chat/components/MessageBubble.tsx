import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Modal, Vibration, Alert } from 'react-native';
import { Video, ResizeMode, Audio, AVPlaybackStatus } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { messageBubbleStyles as styles } from '../../../styles/ChatComponents.styles';
import { messageBubbleMediaStyles as mediaStyles } from '../../../styles/ChatComponents.styles';
import { Ionicons } from '@expo/vector-icons';
import { mediaService } from '../../../services/media.service';
import Autolink from 'react-native-autolink';
import { API_URL } from '../../../config/api.config';
import { apiClient } from '../../../lib/api-client';
import { MessageMetadata } from '../../../types/chat.types';
import { useSubscription } from '../../../hooks/useSubscription';
import { APP_TIERS } from '../../../config/revenuecat.config';
import { DocumentViewerModal } from './DocumentViewerModal';

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

function isImageAttachment(mimeType?: string, fileName?: string): boolean {
    if (mimeType?.toLowerCase().startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(fileName || '');
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
    type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'file' | 'call' | 'call_ended' | 'call_rejected' | 'call_missed';
    replyToContent?: string;
    replyToSender?: string;
    publicId?: string;
    duration?: number;
    senderName?: string;
    updatedAt?: string;
    readAt?: string;
    metadata?: MessageMetadata;
    onNeedUpgrade?: (feature: 'transcription' | 'transcription_blocked') => void;
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
    onNeedUpgrade,
}: MessageBubbleProps) {
    const insets = useSafeAreaInsets();
    const videoRef = useRef<Video>(null);
    const { canUseTranscription, recordTranscriptionUse, planTier } = useSubscription();
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isMediaRenderReady, setIsMediaRenderReady] = useState(false);
    const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
    const mediaRequestRef = useRef(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);
    const [audioDuration, setAudioDuration] = useState<number | null>(null);
    const [transcription, setTranscription] = useState<string | null>(
        typeof metadata?.transcription === 'string' ? metadata.transcription : null
    );
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [showTranscription, setShowTranscription] = useState(
        Boolean(metadata?.transcription)
    );
    const [docViewer, setDocViewer] = useState<{
        visible: boolean;
        uri: string | null;
        localUri: string | null;
        fileName: string;
        mimeType?: string;
    }>({ visible: false, uri: null, localUri: null, fileName: 'Documento' });

    const attachmentFileName = metadata?.fileName || (metadata as any)?.filename || 'Archivo adjunto';
    const attachmentMimeType = metadata?.mimeType || (metadata as any)?.mime || undefined;
    const isDocumentImage =
        (type === 'document' || type === 'file') &&
        isImageAttachment(attachmentMimeType, attachmentFileName);

    useEffect(() => {
        if (typeof metadata?.transcription === 'string' && metadata.transcription) {
            setTranscription(metadata.transcription);
            setShowTranscription(true);
        }
    }, [metadata?.transcription]);

    // Auto-load media. A request token prevents a slower previous URI from
    // replacing the media selected by the current message.
    useEffect(() => {
        const requestId = ++mediaRequestRef.current;
        let cancelled = false;

        setMediaUri(null);
        setIsMediaRenderReady(false);
        setImageSize(null);

        const loadMedia = async () => {
            if ((type === 'image' || type === 'video' || type === 'audio' || type === 'document' || type === 'file') && content) {
                // 1. If it's a local file (e.g. pending upload), use it immediately
                if (content.startsWith('file://')) {
                    if (cancelled || requestId !== mediaRequestRef.current) return;
                    setMediaUri(content);
                    setIsLoading(false);
                    return;
                }

                setIsLoading(true);
                const normalizeUrl = (url: string) => {
                    if (url.startsWith('http')) return url;
                    return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
                };
                
                try {

                    const resolvedKey = resolveChatMediaKey(publicId, content, API_URL);
                    const localUri = await mediaService.downloadMedia(
                        resolvedKey,
                        isDocumentImage ? 'document' : type as 'image' | 'video' | 'audio' | 'document',
                        isDocumentImage
                            ? { mimeType: attachmentMimeType, resourceType: 'raw' }
                            : undefined,
                    );

                    if (cancelled || requestId !== mediaRequestRef.current) return;

                    if (localUri) {
                        setMediaUri(localUri);
                    } else {
                        const playable =
                            resolvedKey.startsWith('http') || resolvedKey.startsWith('file://');
                        setMediaUri(playable ? resolvedKey : normalizeUrl(content));
                    }
                } catch (e) {
                    if (cancelled || requestId !== mediaRequestRef.current) return;
                    console.error('Failed to load/cache media:', e);
                    const key = resolveChatMediaKey(publicId, content, API_URL);
                    setMediaUri(key.startsWith('http') || key.startsWith('file://') ? key : normalizeUrl(content));
                } finally {
                    if (!cancelled && requestId === mediaRequestRef.current) {
                        setIsLoading(false);
                    }
                }
            }
        };
        loadMedia();

        return () => {
            cancelled = true;
        };
    }, [content, type, publicId, isDocumentImage, attachmentMimeType]);

    useEffect(() => {
        if (!mediaUri || (type !== 'image' && !isDocumentImage)) return;

        let cancelled = false;
        Image.getSize(
            mediaUri,
            (width, height) => {
                if (!cancelled && width > 0 && height > 0) setImageSize({ width, height });
            },
            () => {
                if (!cancelled) setImageSize(null);
            },
        );

        return () => {
            cancelled = true;
        };
    }, [mediaUri, type, isDocumentImage]);

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

    const handleTranscribeAudio = async () => {
        if (transcription) {
            setShowTranscription((prev) => !prev);
            return;
        }

        if (!canUseTranscription()) {
            onNeedUpgrade?.(planTier === APP_TIERS.GRATIS ? 'transcription_blocked' : 'transcription');
            return;
        }

        if (!mediaUri) {
            Alert.alert('Audio no listo', 'Espera a que el audio termine de cargar.');
            return;
        }

        setIsTranscribing(true);
        try {
            const text = await mediaService.audioToText(mediaUri);
            if (!text) {
                Alert.alert('Sin texto', 'No se pudo detectar voz en este audio.');
                return;
            }
            setTranscription(text);
            setShowTranscription(true);
            await recordTranscriptionUse();
        } catch (e) {
            console.error('Transcription error:', e);
            Alert.alert('Error', 'No se pudo transcribir el audio. Intenta de nuevo.');
        } finally {
            setIsTranscribing(false);
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

        const imageFrameStyle = imageSize
            ? {
                width: Math.min(240, imageSize.width),
                height: Math.min(280, Math.max(120, imageSize.height * Math.min(240, imageSize.width) / imageSize.width)),
            }
            : mediaStyles.thumbnail;

        if (type === 'image') {
            return (
                <TouchableOpacity
                    onPress={() => setShowFullscreen(true)}
                    activeOpacity={0.9}
                    style={[mediaStyles.imageFrame, imageFrameStyle]}
                >
                    {!isMediaRenderReady && (
                        <View style={mediaStyles.imageLoadingOverlay}>
                            <ActivityIndicator color="#FFFFFF" />
                        </View>
                    )}
                    <Image
                        source={{ uri: mediaUri }}
                        style={[mediaStyles.thumbnail, imageFrameStyle, { opacity: isMediaRenderReady ? 1 : 0 }]}
                        resizeMode="contain"
                        onLoadEnd={() => setIsMediaRenderReady(true)}
                        onError={() => setIsMediaRenderReady(false)}
                    />
                </TouchableOpacity>
            );
        }

        if (type === 'video') {
            const isVideoNote = Boolean(metadata?.isVideoNote);
            return (
                <TouchableOpacity
                    onPress={() => setShowFullscreen(true)}
                    activeOpacity={0.9}
                    style={isVideoNote ? mediaStyles.videoNoteThumbWrap : mediaStyles.videoThumbWrap}
                >
                    <Video
                        source={{ uri: mediaUri }}
                        style={isVideoNote ? mediaStyles.videoNoteThumbnail : mediaStyles.thumbnail}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                        isMuted
                        useNativeControls={false}
                    />
                    <View style={mediaStyles.videoPlayOverlay} pointerEvents="none">
                        <View style={isVideoNote ? mediaStyles.videoNotePlayBadge : mediaStyles.videoPlayBadge}>
                            <Ionicons
                              name="play"
                              size={isVideoNote ? 22 : 28}
                              color="#FFF"
                              style={{ marginLeft: 3 }}
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        if (type === 'audio') {
            // Use extracted duration, fallback to prop
            const displayDuration = audioDuration ?? duration;
            return (
                <View>
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

                    <TouchableOpacity
                        style={mediaStyles.audioTranscriptToggle}
                        onPress={handleTranscribeAudio}
                        disabled={isTranscribing || isLoading}
                    >
                        {isTranscribing ? (
                            <ActivityIndicator size="small" color={isMine ? 'rgba(255,255,255,0.85)' : '#4CAF50'} />
                        ) : (
                            <Text style={[
                                mediaStyles.audioTranscriptToggleText,
                                { color: isMine ? 'rgba(255,255,255,0.85)' : '#4CAF50' },
                            ]}>
                                {transcription
                                    ? (showTranscription ? 'Ocultar transcripción' : 'Ver transcripción')
                                    : 'Ver transcripción'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    {showTranscription && transcription ? (
                        <View style={[
                            mediaStyles.audioTranscriptBox,
                            isMine && mediaStyles.audioTranscriptBoxMine,
                        ]}>
                            <Text style={[
                                mediaStyles.audioTranscriptText,
                                { color: isMine ? 'rgba(255,255,255,0.92)' : '#374151' },
                            ]}>
                                {transcription}
                            </Text>
                        </View>
                    ) : null}
                </View>
            );
        }

        if (type === 'document' || type === 'file') {
            const fileName = attachmentFileName;
            const mimeType = attachmentMimeType;

            const ensureExtension = (name: string): string => {
                if (/\.[a-z0-9]{1,8}$/i.test(name)) return name;
                const mimeExt: Record<string, string> = {
                    'application/pdf': 'pdf',
                    'image/png': 'png',
                    'image/jpeg': 'jpg',
                    'image/jpg': 'jpg',
                    'image/webp': 'webp',
                    'image/gif': 'gif',
                    'application/msword': 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
                    'application/vnd.ms-excel': 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
                    'application/vnd.ms-powerpoint': 'ppt',
                    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
                    'text/plain': 'txt',
                    'application/zip': 'zip',
                    'audio/mpeg': 'mp3',
                    'audio/m4a': 'm4a',
                    'video/mp4': 'mp4',
                };
                const ext = mimeType ? mimeExt[mimeType] : undefined;
                if (ext) return `${name}.${ext}`;
                // Fallback: intentar extensión desde publicId/content de Cloudinary
                const fromKey = (publicId || content || '').match(/\.([a-z0-9]{1,8})(?:$|\?)/i);
                return fromKey ? `${name}.${fromKey[1]}` : name;
            };

            const handleOpenDocument = async () => {
                try {
                    setIsLoading(true);
                    const resolvedKey = resolveChatMediaKey(publicId, content, API_URL);
                    let httpUrl: string | null = null;

                    if (resolvedKey && resolvedKey.startsWith('http')) {
                        httpUrl = resolvedKey;
                    } else if (resolvedKey) {
                        httpUrl = await mediaService.getSignedUrl(
                            resolvedKey,
                            type as 'document' | 'file',
                            isDocumentImage ? 'raw' : undefined,
                        );
                    }

                    if (!httpUrl && mediaUri && mediaUri.startsWith('http')) {
                        httpUrl = mediaUri;
                    }

                    const rawFileName = metadata?.fileName || (metadata as any)?.filename || 'archivo_adjunto';
                    const withExt = ensureExtension(rawFileName);
                    const sanitizedFileName = withExt.replace(/[^a-zA-Z0-9_.-]/g, '_');
                    const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
                    const localPath = `${docDir}${Date.now()}_${sanitizedFileName}`;

                    let targetFileUri: string | null = mediaUri && mediaUri.startsWith('file://') ? mediaUri : null;

                    // Preferir siempre la copia local ya validada. Solo descargar
                    // desde la URL remota si todavía no hay una copia disponible.
                    if (!targetFileUri && httpUrl) {
                        try {
                            const downloadRes = await FileSystem.downloadAsync(httpUrl, localPath);
                            if (downloadRes.status === 200) {
                                targetFileUri = downloadRes.uri;
                            }
                        } catch (dlErr) {
                            console.warn('Error downloading document/file for native view:', dlErr);
                        }
                    }

                    if (!httpUrl && !targetFileUri) {
                        Alert.alert('Error', 'No se pudo obtener el archivo.');
                        return;
                    }

                    // Visor in-app (estilo WhatsApp). No abrir "Abrir con..." del sistema.
                    setDocViewer({
                        visible: true,
                        uri: targetFileUri || httpUrl,
                        localUri: targetFileUri,
                        fileName,
                        mimeType,
                    });
                } catch (err) {
                    console.error('Error opening file natively:', err);
                    Alert.alert('Error', 'No se pudo abrir el archivo.');
                } finally {
                    setIsLoading(false);
                }
            };

            if (isDocumentImage) {
                return (
                    <>
                        <TouchableOpacity
                            onPress={handleOpenDocument}
                            activeOpacity={0.9}
                            style={[mediaStyles.documentImageWrap, imageFrameStyle]}
                        >
                            {!isMediaRenderReady && (
                                <View style={mediaStyles.imageLoadingOverlay}>
                                    <ActivityIndicator color="#FFFFFF" />
                                </View>
                            )}
                            <Image
                                source={{ uri: mediaUri || undefined }}
                                style={[mediaStyles.thumbnail, imageFrameStyle, { opacity: isMediaRenderReady ? 1 : 0 }]}
                                resizeMode="contain"
                                onLoadEnd={() => setIsMediaRenderReady(true)}
                                onError={() => setIsMediaRenderReady(false)}
                            />
                            <View style={mediaStyles.documentImageLabel} pointerEvents="none">
                                <Ionicons name="document-attach-outline" size={16} color="#FFF" />
                                <Text style={mediaStyles.documentImageLabelText} numberOfLines={1}>
                                    {fileName}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <DocumentViewerModal
                            visible={docViewer.visible}
                            onClose={() => setDocViewer(prev => ({ ...prev, visible: false }))}
                            uri={docViewer.uri}
                            localUri={docViewer.localUri}
                            fileName={docViewer.fileName}
                            mimeType={docViewer.mimeType}
                        />
                    </>
                );
            }

            return (
                <>
                <TouchableOpacity onPress={handleOpenDocument} style={mediaStyles.document} activeOpacity={0.8}>
                    <View style={mediaStyles.documentIconContainer}>
                        {isLoading ? (
                            <ActivityIndicator color={isMine ? 'white' : '#4F46E5'} size="small" />
                        ) : (
                            <Ionicons name="document-text" size={32} color={isMine ? 'white' : '#4F46E5'} />
                        )}
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
                <DocumentViewerModal
                    visible={docViewer.visible}
                    onClose={() => setDocViewer(prev => ({ ...prev, visible: false }))}
                    uri={docViewer.uri}
                    localUri={docViewer.localUri}
                    fileName={docViewer.fileName}
                    mimeType={docViewer.mimeType}
                />
                </>
            );
        }

        return null;
    };

    const closeFullscreen = async () => {
        try {
            if (videoRef.current) {
                await videoRef.current.pauseAsync();
                await videoRef.current.setPositionAsync(0);
            }
        } catch {
            // ignore unload/seek errors while closing
        }
        setShowFullscreen(false);
    };

    const handleSaveImageToGallery = async () => {
        if (type !== 'image' || !mediaUri || isSavingToGallery) return;

        setIsSavingToGallery(true);
        try {
            await mediaService.saveImageToGallery(mediaUri);
            Alert.alert('Imagen guardada', 'La imagen se guardó en tu galería.');
        } catch (error) {
            console.error('Save image to gallery failed:', error);
            Alert.alert('No se pudo guardar', 'Verificá el permiso de galería e intentá nuevamente.');
        } finally {
            setIsSavingToGallery(false);
        }
    };

    const handleVideoStatusUpdate = async (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
            try {
                await videoRef.current?.setPositionAsync(0);
                await videoRef.current?.pauseAsync();
            } catch (e) {
                console.error('Failed to reset video after finish:', e);
            }
        }
    };

    // Fullscreen image / video modal
    const renderFullscreenModal = () => (
        <Modal
            visible={showFullscreen}
            transparent
            animationType="fade"
            onRequestClose={closeFullscreen}
            statusBarTranslucent
        >
            <View style={mediaStyles.modalBackdrop}>
                <View
                    style={[
                        mediaStyles.modalContent,
                        {
                            paddingTop: insets.top + 8,
                            paddingBottom: insets.bottom + 12,
                            paddingHorizontal: Math.max(insets.left, insets.right, 8),
                        },
                    ]}
                >
                    {type === 'video' && mediaUri && showFullscreen ? (
                        <Video
                            ref={videoRef}
                            source={{ uri: mediaUri }}
                            style={mediaStyles.fullscreenVideo}
                            resizeMode={ResizeMode.CONTAIN}
                            useNativeControls
                            shouldPlay
                            onPlaybackStatusUpdate={handleVideoStatusUpdate}
                        />
                    ) : type === 'image' && mediaUri ? (
                        <Image
                            source={{ uri: mediaUri }}
                            style={mediaStyles.fullscreenImage}
                            resizeMode="contain"
                        />
                    ) : null}
                    <TouchableOpacity
                        style={[mediaStyles.closeButton, { top: insets.top + 12 }]}
                        onPress={closeFullscreen}
                    >
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    {type === 'image' && (
                        <TouchableOpacity
                            style={[mediaStyles.galleryButton, { top: insets.top + 12, right: 60 }]}
                            onPress={handleSaveImageToGallery}
                            disabled={isSavingToGallery}
                            accessibilityRole="button"
                            accessibilityLabel="Guardar imagen en la galería"
                        >
                            {isSavingToGallery ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <Ionicons name="download-outline" size={25} color="white" />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
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
    const isVideoNote = type === 'video' && Boolean(metadata?.isVideoNote);

    // Nota de video: sin fondo de burbuja (estilo WhatsApp)
    if (isVideoNote) {
        return (
            <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
                <View style={mediaStyles.videoNoteBubble}>
                    {senderName ? (
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: senderColor, marginBottom: 4 }}>
                            {senderName}
                        </Text>
                    ) : null}
                    {renderReplyQuote()}
                    <View style={mediaStyles.videoNoteOuter}>
                        {renderMedia()}
                        <View style={mediaStyles.videoNoteFooter} pointerEvents="none">
                            <Text style={mediaStyles.videoNoteTime}>{formatTime(time)}</Text>
                            {renderCheckmarks()}
                        </View>
                    </View>
                </View>
                {renderFullscreenModal()}
            </View>
        );
    }

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
            {(type === 'image' || type === 'video') && renderFullscreenModal()}
        </View>
    );
}

