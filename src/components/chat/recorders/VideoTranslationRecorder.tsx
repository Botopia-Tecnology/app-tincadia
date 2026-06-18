/**
 * VideoTranslationRecorder Component
 * 
 * Records video for sign language translation.
 * Enhanced Features:
 * - Countdown (3, 2, 1) before recording starts
 * - Multiple clip recording
 * - Concatenate translations from multiple clips
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    ScrollView,
    Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Video, ResizeMode, Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../../config/api.config';
import { videoTranslationRecorderStyles as styles } from '../../../styles/ChatRecorders.styles';

interface VideoClip {
    uri: string;
    translation?: string;
    isTranslating?: boolean;
}

interface VideoTranslationRecorderProps {
    visible: boolean;
    onClose: () => void;
    onTranslationReceived: (text: string) => void;
}

export function VideoTranslationRecorder({
    visible,
    onClose,
    onTranslationReceived,
}: VideoTranslationRecorderProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const [facing, setFacing] = useState<CameraType>('front');
    const [hasAudioPermission, setHasAudioPermission] = useState(false);
    const cameraRef = useRef<CameraView>(null);

    // Recording states
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [isRecording, setIsRecording] = useState(false);
    const [currentRecordingUri, setCurrentRecordingUri] = useState<string | null>(null);

    // Multi-clip state
    const [clips, setClips] = useState<VideoClip[]>([]);
    const [previewClipIndex, setPreviewClipIndex] = useState<number | null>(null);
    const [isProcessingAll, setIsProcessingAll] = useState(false);

    useEffect(() => {
        const requestPermissions = async () => {
            if (!permission?.granted) {
                await requestPermission();
            }
            const { status } = await Audio.requestPermissionsAsync();
            setHasAudioPermission(status === 'granted');
        };

        if (visible) {
            requestPermissions();
        }
    }, [visible]);

    // Reset state when modal closes
    useEffect(() => {
        if (!visible) {
            setClips([]);
            setCurrentRecordingUri(null);
            setPreviewClipIndex(null);
            setIsCountingDown(false);
            setCountdown(3);
        }
    }, [visible]);

    const startCountdown = () => {
        setIsCountingDown(true);
        setCountdown(3);

        let count = 3;
        const interval = setInterval(() => {
            count -= 1;
            if (count > 0) {
                setCountdown(count);
            } else {
                clearInterval(interval);
                setIsCountingDown(false);
                startRecording();
            }
        }, 1000);
    };

    const startRecording = async () => {
        if (!cameraRef.current) return;

        setIsRecording(true);
        try {
            const video = await cameraRef.current.recordAsync({
                maxDuration: 15, // 15 seconds max per clip
            });
            if (video) {
                setCurrentRecordingUri(video.uri);
            }
        } catch (error) {
            console.error('Recording error:', error);
        }
        setIsRecording(false);
    };

    const stopRecording = () => {
        if (cameraRef.current && isRecording) {
            cameraRef.current.stopRecording();
        }
    };

    const handleAddClip = () => {
        if (currentRecordingUri) {
            setClips(prev => [...prev, { uri: currentRecordingUri }]);
            setCurrentRecordingUri(null);
        }
    };

    const handleRetakeCurrentClip = () => {
        setCurrentRecordingUri(null);
    };

    const handleDeleteClip = (index: number) => {
        setClips(prev => prev.filter((_, i) => i !== index));
        if (previewClipIndex === index) {
            setPreviewClipIndex(null);
        }
    };

    const translateClip = async (clipUri: string): Promise<string> => {
        const formData = new FormData();
        formData.append('file', {
            uri: clipUri,
            type: 'video/mp4',
            name: 'video.mp4',
        } as any);

        const response = await fetch(`${API_URL}/model/video-to-text`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        const result = await response.json();
        if (result.success && result.text) {
            return result.text;
        }
        throw new Error(result.error || 'Error al traducir');
    };

    const handleTranslateAll = async () => {
        // If there's a current recording not yet added, add it first
        let allClips = [...clips];
        if (currentRecordingUri) {
            allClips.push({ uri: currentRecordingUri });
        }

        if (allClips.length === 0) {
            Alert.alert('Sin videos', 'Graba al menos un video antes de traducir.');
            return;
        }

        setIsProcessingAll(true);

        try {
            const translations: string[] = [];

            for (let i = 0; i < allClips.length; i++) {
                const clip = allClips[i];
                // Update clip to show it's being translated
                setClips(prev => {
                    const updated = [...prev];
                    if (updated[i]) {
                        updated[i] = { ...updated[i], isTranslating: true };
                    }
                    return updated;
                });

                const translation = await translateClip(clip.uri);
                translations.push(translation);

                // Update clip with translation
                setClips(prev => {
                    const updated = [...prev];
                    if (updated[i]) {
                        updated[i] = { ...updated[i], translation, isTranslating: false };
                    }
                    return updated;
                });
            }

            // Concatenate all translations
            const fullTranslation = translations.join(' ');
            onTranslationReceived(fullTranslation);
            handleClose();

        } catch (error) {
            console.error('Translation error:', error);
            Alert.alert('Error', 'Error al traducir uno de los videos.');
        } finally {
            setIsProcessingAll(false);
        }
    };

    const handleClose = () => {
        setClips([]);
        setCurrentRecordingUri(null);
        setPreviewClipIndex(null);
        setIsCountingDown(false);
        setIsRecording(false);
        setIsProcessingAll(false);
        onClose();
    };

    const toggleCameraFacing = () => {
        setFacing(current => (current === 'back' ? 'front' : 'back'));
    };

    if (!visible) return null;

    // Which view to show
    const showPreview = currentRecordingUri !== null;
    const showClipList = clips.length > 0 && !showPreview;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Traducir Señas</Text>
                    <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
                        <Ionicons name="camera-reverse" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Clip count indicator */}
                {clips.length > 0 && (
                    <View style={styles.clipCounter}>
                        <Text style={styles.clipCounterText}>
                            {clips.length} {clips.length === 1 ? 'seña grabada' : 'señas grabadas'}
                        </Text>
                    </View>
                )}

                {/* Camera / Preview Area */}
                <View style={styles.cameraContainer}>
                    {!permission?.granted ? (
                        <View style={styles.permissionContainer}>
                            <Text style={styles.permissionText}>Se necesita permiso de cámara</Text>
                            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                                <Text style={styles.permissionButtonText}>Dar Permiso</Text>
                            </TouchableOpacity>
                        </View>
                    ) : showPreview ? (
                        // Preview current recording
                        <Video
                            source={{ uri: currentRecordingUri! }}
                            style={styles.videoPreview}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            shouldPlay
                        />
                    ) : previewClipIndex !== null ? (
                        // Preview a saved clip
                        <Video
                            source={{ uri: clips[previewClipIndex].uri }}
                            style={styles.videoPreview}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            shouldPlay
                        />
                    ) : (
                        // Camera View
                        <CameraView
                            ref={cameraRef}
                            style={styles.camera}
                            facing={facing}
                            mode="video"
                        />
                    )}

                    {/* Countdown Overlay */}
                    {isCountingDown && (
                        <View style={styles.countdownOverlay}>
                            <Text style={styles.countdownText}>{countdown}</Text>
                            <Text style={styles.countdownSubtext}>Prepárate...</Text>
                        </View>
                    )}

                    {/* Recording Indicator */}
                    {isRecording && (
                        <View style={styles.recordingIndicator}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingText}>Grabando...</Text>
                        </View>
                    )}
                </View>

                {/* Clip thumbnails */}
                {clips.length > 0 && !showPreview && (
                    <ScrollView
                        horizontal
                        style={styles.clipList}
                        contentContainerStyle={styles.clipListContent}
                        showsHorizontalScrollIndicator={false}
                    >
                        {clips.map((clip, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.clipThumbnail,
                                    previewClipIndex === index && styles.clipThumbnailActive
                                ]}
                                onPress={() => setPreviewClipIndex(previewClipIndex === index ? null : index)}
                            >
                                <Text style={styles.clipNumber}>{index + 1}</Text>
                                {clip.isTranslating && (
                                    <ActivityIndicator size="small" color="white" style={styles.clipLoader} />
                                )}
                                {clip.translation && (
                                    <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={styles.clipDone} />
                                )}
                                <TouchableOpacity
                                    style={styles.clipDelete}
                                    onPress={() => handleDeleteClip(index)}
                                >
                                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {/* Controls */}
                <View style={styles.controls}>
                    {showPreview ? (
                        // Preview controls: Retake, Add Another, Translate
                        <View style={styles.previewControls}>
                            <TouchableOpacity style={styles.actionButton} onPress={handleRetakeCurrentClip}>
                                <Ionicons name="refresh" size={24} color="white" />
                                <Text style={styles.actionButtonText}>Repetir</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.addButton]}
                                onPress={() => {
                                    handleAddClip();
                                    // Start recording another immediately
                                    setTimeout(() => startCountdown(), 300);
                                }}
                            >
                                <Ionicons name="add-circle" size={24} color="white" />
                                <Text style={styles.actionButtonText}>Otra Seña</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.translateButton]}
                                onPress={handleTranslateAll}
                                disabled={isProcessingAll}
                            >
                                {isProcessingAll ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="language" size={24} color="white" />
                                        <Text style={styles.actionButtonText}>Traducir</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : previewClipIndex !== null ? (
                        // Viewing a saved clip
                        <View style={styles.previewControls}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => setPreviewClipIndex(null)}
                            >
                                <Ionicons name="arrow-back" size={24} color="white" />
                                <Text style={styles.actionButtonText}>Volver</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionButton, styles.translateButton]}
                                onPress={handleTranslateAll}
                                disabled={isProcessingAll}
                            >
                                {isProcessingAll ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="language" size={24} color="white" />
                                        <Text style={styles.actionButtonText}>Traducir Todo</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : (
                        // Camera controls
                        <View style={styles.recordingControls}>
                            {isRecording ? (
                                <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
                                    <View style={styles.stopButtonInner} />
                                </TouchableOpacity>
                            ) : isCountingDown ? (
                                <View style={styles.recordButton}>
                                    <Text style={styles.countdownSmall}>{countdown}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.recordButton} onPress={startCountdown}>
                                    <View style={styles.recordButtonInner} />
                                </TouchableOpacity>
                            )}
                            <Text style={styles.recordingHint}>
                                {isRecording ? 'Toca para detener' : isCountingDown ? 'Preparándose...' : 'Toca para grabar'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Processing Overlay */}
                {isProcessingAll && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={styles.processingText}>Traduciendo señas...</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

