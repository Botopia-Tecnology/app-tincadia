import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

interface UseAudioRecorderProps {
    onCancel?: () => void;
}

export function useAudioRecorder({ onCancel }: UseAudioRecorderProps = {}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [metering, setMetering] = useState(-160);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    // Timer ref
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                {
                    ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
                    isMeteringEnabled: true,
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
                },
                (status) => {
                    if (status.metering !== undefined) {
                        setMetering(status.metering);
                    }
                },
                50 // 50ms interval for smooth wave animation
            );

            setRecording(newRecording);
            setIsRecording(true);
            setIsPaused(false);
            setDuration(0);

            // Start Timer
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);

        } catch (err) {
            console.error('Failed to start recording', err);
            if (onCancel) onCancel();
        }
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

    const pauseRecording = async () => {
        if (!recording || isPaused) return;

        try {
            await recording.pauseAsync();
            setIsPaused(true);
            // Pause timer
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        } catch (error) {
            console.error('Error pausing recording:', error);
        }
    };

    const resumeRecording = async () => {
        if (!recording || !isPaused) return;

        try {
            await recording.startAsync();
            setIsPaused(false);
            // Resume timer
            timerRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);
        } catch (error) {
            console.error('Error resuming recording:', error);
        }
    };

    const cancelRecording = async () => {
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
        setIsPaused(false);
        setDuration(0);

        if (onCancel) onCancel();
    };

    const stopAndGetUri = async (): Promise<string | null> => {
        cleanup();

        if (!recording) {
            if (onCancel) onCancel();
            return null;
        }

        try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            setRecording(null);
            setIsRecording(false);
            setIsPaused(false);

            return uri;
        } catch (error) {
            console.error('Error stopping recording:', error);
            if (onCancel) onCancel();
            return null;
        }
    };

    return {
        isRecording,
        isPaused,
        duration,
        metering,
        checkPermissionAndStart,
        pauseRecording,
        resumeRecording,
        cancelRecording,
        stopAndGetUri,
    };
}
