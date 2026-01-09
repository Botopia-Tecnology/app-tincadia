import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated as RNAnimated } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { SendIcon } from '../icons/NavigationIcons';

interface AudioRecorderProps {
    onSend: (uri: string, duration: number) => void;
    onCancel?: () => void;
    activeColor?: string;
}

export function AudioRecorder({ onSend, onCancel, activeColor = '#4F46E5' }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    // Animation for waveform
    const waveAnim = useRef(new RNAnimated.Value(0)).current;

    // Timer ref
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        checkPermissionAndStart();

        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        waveAnim.stopAnimation();
    };

    const checkPermissionAndStart = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                console.error('Audio permission not granted');
                if (onCancel) onCancel();
                return;
            }
            await startRecording();
        } catch (err) {
            console.error('Permission error:', err);
            if (onCancel) onCancel();
        }
    };

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync({
                ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                ios: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                },
                android: {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                }
            });

            setRecording(recording);
            setIsRecording(true);
            setIsPaused(false);

            // Start Timer
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);

            // Animate waveform
            RNAnimated.loop(
                RNAnimated.sequence([
                    RNAnimated.timing(waveAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
                    RNAnimated.timing(waveAnim, { toValue: 0, duration: 300, useNativeDriver: true })
                ])
            ).start();

        } catch (err) {
            console.error('Failed to start recording', err);
            if (onCancel) onCancel();
        }
    };

    const handlePauseResume = async () => {
        if (!recording) return;

        try {
            if (isPaused) {
                // Resume
                await recording.startAsync();
                setIsPaused(false);
                // Resume timer
                timerRef.current = setInterval(() => {
                    setDuration(d => d + 1);
                }, 1000);
            } else {
                // Pause
                await recording.pauseAsync();
                setIsPaused(true);
                // Pause timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        } catch (error) {
            console.error('Error pausing/resuming:', error);
        }
    };

    const handleCancel = async () => {
        cleanup();

        if (recording) {
            try {
                await recording.stopAndUnloadAsync();
            } catch (error) {
                console.error('Error stopping recording:', error);
            }
        }

        setRecording(null);
        setIsRecording(false);
        setDuration(0);

        if (onCancel) onCancel();
    };

    const handleSend = async () => {
        cleanup();

        if (!recording) {
            if (onCancel) onCancel();
            return;
        }

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            setRecording(null);
            setIsRecording(false);

            if (uri) {
                onSend(uri, duration);
            } else if (onCancel) {
                onCancel();
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
            if (onCancel) onCancel();
        }
    };

    // Format duration
    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Simple waveform visualization
    const renderWaveform = () => {
        const bars = 20;
        return (
            <View style={styles.waveformContainer}>
                {Array.from({ length: bars }).map((_, i) => {
                    const height = Math.random() * 20 + 5;
                    return (
                        <RNAnimated.View
                            key={i}
                            style={[
                                styles.waveBar,
                                {
                                    height: isPaused ? 3 : height,
                                    opacity: waveAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.5, 1]
                                    })
                                }
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Top Row: Timer + Waveform */}
            <View style={styles.topRow}>
                <Text style={styles.timerText}>{formatDuration(duration)}</Text>
                {renderWaveform()}
            </View>

            {/* Bottom Row: Cancel, Pause, Send */}
            <View style={styles.bottomRow}>
                {/* Cancel Button */}
                <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
                    <Ionicons name="trash-outline" size={24} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Pause/Resume Button */}
                <TouchableOpacity onPress={handlePauseResume} style={styles.pauseButton}>
                    <Ionicons
                        name={isPaused ? "play" : "pause"}
                        size={28}
                        color="#EF4444"
                    />
                </TouchableOpacity>

                {/* Send Button */}
                <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: '#22C55E' }]}>
                    <SendIcon size={22} color="white" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#E5E7EB',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    timerText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        fontVariant: ['tabular-nums'],
        marginRight: 16,
        minWidth: 40,
    },
    waveformContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        gap: 2,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#6B7280',
        borderRadius: 1.5,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cancelButton: {
        padding: 10,
    },
    pauseButton: {
        padding: 10,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
