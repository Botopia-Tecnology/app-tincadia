

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SendIcon } from '../../icons/NavigationIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface AudioRecorderProps {
    onSend: (uri: string, duration: number) => void;
    onCancel?: () => void;
    activeColor?: string;
}

export function AudioRecorder({ onSend, onCancel, activeColor = '#4F46E5' }: AudioRecorderProps) {
    const { colors } = useTheme();

    const {
        isRecording,
        isPaused,
        duration,
        metering,
        checkPermissionAndStart,
        pauseRecording,
        resumeRecording,
        cancelRecording,
        stopAndGetUri,
    } = useAudioRecorder({ onCancel });

    const [waveHistory, setWaveHistory] = useState<number[]>(Array(20).fill(3));

    useEffect(() => {
        checkPermissionAndStart();
    }, []);

    useEffect(() => {
        if (isRecording && !isPaused) {
            setWaveHistory(prev => {
                const newHistory = [...prev.slice(1)];
                // Convert metering (-160 to 0) to a bar height (3 to 25)
                // -60 dB is a good floor for typical voice recording
                let normalized = 0;
                if (metering !== undefined) {
                    const minDb = -60;
                    const val = Math.max(minDb, metering);
                    normalized = ((val - minDb) / Math.abs(minDb)); // 0 to 1
                }
                // Add some slight randomness to make it look organic even when quiet
                const baseHeight = 3 + (normalized * 22);
                const jitter = normalized > 0.1 ? (Math.random() * 2 - 1) : 0;
                const newHeight = Math.max(3, Math.min(25, baseHeight + jitter));
                
                newHistory.push(newHeight);
                return newHistory;
            });
        }
    }, [metering, isRecording, isPaused]);

    const handlePauseResume = async () => {
        if (isPaused) {
            await resumeRecording();
        } else {
            await pauseRecording();
        }
    };

    const handleSend = async () => {
        const uri = await stopAndGetUri();
        if (uri) {
            onSend(uri, duration);
        }
    };

    // Format duration
    const formatDuration = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Waveform visualization reacting to mic
    const renderWaveform = () => {
        return (
            <View style={styles.waveformContainer}>
                {waveHistory.map((height, i) => {
                    return (
                        <View
                            key={i}
                            style={[
                                styles.waveBar,
                                {
                                    backgroundColor: colors.textSecondary,
                                    height: isPaused ? 3 : height,
                                }
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Top Row: Timer + Waveform */}
            <View style={styles.topRow}>
                <Text style={[styles.timerText, { color: colors.text }]}>{formatDuration(duration)}</Text>
                {renderWaveform()}
            </View>

            {/* Bottom Row: Cancel, Pause, Send */}
            <View style={styles.bottomRow}>
                {/* Cancel Button */}
                <TouchableOpacity onPress={cancelRecording} style={styles.cancelButton}>
                    <Ionicons name="trash-outline" size={24} color={colors.textMuted} />
                </TouchableOpacity>

                {/* Pause/Resume Button */}
                <TouchableOpacity onPress={handlePauseResume} style={styles.pauseButton}>
                    <Ionicons
                        name={isPaused ? "play" : "pause"}
                        size={28}
                        color={colors.error}
                    />
                </TouchableOpacity>

                {/* Send Button */}
                <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: colors.success }]}>
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
