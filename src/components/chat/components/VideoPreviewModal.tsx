/**
 * Video Preview Modal
 * 
 * Shows a preview of the recorded video before sending for translation.
 */

import React, { useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { videoPreviewModalStyles as styles } from '../../../styles/ChatModals.styles';

interface VideoPreviewModalProps {
    visible: boolean;
    videoUri: string | null;
    onConfirm: () => void;
    onCancel: () => void;
    onRetake: () => void;
    isLoading?: boolean;
}



export function VideoPreviewModal({
    visible,
    videoUri,
    onConfirm,
    onCancel,
    onRetake,
    isLoading = false
}: VideoPreviewModalProps) {
    const videoRef = useRef<Video>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    if (!visible || !videoUri) return null;

    return (
        <Modal
            visible={visible}
            transparent={false}
            animationType="slide"
            onRequestClose={onCancel}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onCancel} disabled={isLoading}>
                        <Text style={styles.headerButton}>Cancelar</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Vista Previa</Text>
                    <View style={{ width: 70 }} />
                </View>

                <View style={styles.videoContainer}>
                    <Video
                        ref={videoRef}
                        source={{ uri: videoUri }}
                        style={styles.video}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping={false}
                        shouldPlay={false}
                        onPlaybackStatusUpdate={(status) => {
                            if (status.isLoaded) {
                                setIsPlaying(status.isPlaying);
                            }
                        }}
                    />
                </View>

                <View style={styles.instructions}>
                    <Text style={styles.instructionsText}>
                        Revisa tu video antes de enviarlo para traducción
                    </Text>
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.button, styles.retakeButton]}
                        onPress={onRetake}
                        disabled={isLoading}
                    >
                        <Text style={styles.retakeButtonText}>Volver a Grabar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.confirmButton, isLoading && styles.buttonDisabled]}
                        onPress={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Traducir Video</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

