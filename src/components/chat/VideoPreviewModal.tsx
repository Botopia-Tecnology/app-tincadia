/**
 * Video Preview Modal
 * 
 * Shows a preview of the recorded video before sending for translation.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface VideoPreviewModalProps {
    visible: boolean;
    videoUri: string | null;
    onConfirm: () => void;
    onCancel: () => void;
    onRetake: () => void;
    isLoading?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
    },
    headerButton: {
        color: '#007AFF',
        fontSize: 16,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    videoContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
    },
    video: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.5,
    },
    instructions: {
        padding: 20,
        alignItems: 'center',
    },
    instructionsText: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 40,
        gap: 12,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retakeButton: {
        backgroundColor: '#374151',
    },
    retakeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: '#10B981',
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});
