/**
 * VideoNoteRecorder — WhatsApp-style circular video note (max 60s).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, FlashMode } from 'expo-camera';
import { Audio, Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_DURATION_SEC = 60;
const CIRCLE_SIZE = 300;
/** Proporción típica del sensor en vertical (ancho:alto = 3:4). */
const CAMERA_ASPECT = 3 / 4;

/** Caja del preview más alta que el círculo para cubrir sin deformar. */
const previewCoverStyle = {
  position: 'absolute' as const,
  width: CIRCLE_SIZE,
  height: CIRCLE_SIZE / CAMERA_ASPECT,
  left: 0,
  top: (CIRCLE_SIZE - CIRCLE_SIZE / CAMERA_ASPECT) / 2,
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSend: (uri: string, durationSec: number) => void;
}

export function VideoNoteRecorder({ visible, onClose, onSend }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [hasAudio, setHasAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;

    const prepare = async () => {
      if (!permission?.granted) {
        await requestPermission();
      }
      const { status } = await Audio.requestPermissionsAsync();
      setHasAudio(status === 'granted');
    };

    prepare();
    return () => clearTimer();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      resetState();
    }
  }, [visible]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetState = () => {
    clearTimer();
    isRecordingRef.current = false;
    setIsRecording(false);
    setElapsed(0);
    elapsedRef.current = 0;
    setPreviewUri(null);
    setRecordedDuration(0);
    setIsSending(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording || previewUri) return;
    if (!permission?.granted) {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la cámara.');
      return;
    }
    if (!hasAudio) {
      Alert.alert('Permiso requerido', 'Se necesita acceso al micrófono.');
      return;
    }

    try {
      isRecordingRef.current = true;
      setIsRecording(true);
      setElapsed(0);
      elapsedRef.current = 0;

      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        const next = elapsedRef.current;
        setElapsed(next);
        if (next >= MAX_DURATION_SEC) {
          cameraRef.current?.stopRecording();
        }
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SEC,
      });

      clearTimer();
      isRecordingRef.current = false;
      setIsRecording(false);

      if (video?.uri) {
        setPreviewUri(video.uri);
        setRecordedDuration(Math.max(1, Math.min(elapsedRef.current, MAX_DURATION_SEC)));
      }
    } catch (error) {
      console.error('Video note recording error:', error);
      clearTimer();
      isRecordingRef.current = false;
      setIsRecording(false);
      Alert.alert('Error', 'No se pudo grabar la nota de video.');
    }
  };

  const stopRecording = () => {
    if (!cameraRef.current || !isRecordingRef.current) return;
    cameraRef.current.stopRecording();
  };

  const handleShutterPress = () => {
    if (previewUri) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleSend = () => {
    if (!previewUri || isSending) return;
    setIsSending(true);
    const duration = recordedDuration || elapsed || 1;
    onSend(previewUri, duration);
    onClose();
  };

  const handleRetake = () => {
    setPreviewUri(null);
    setRecordedDuration(0);
    setElapsed(0);
    elapsedRef.current = 0;
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={styles.iconBtn} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.timer}>{formatTime(previewUri ? recordedDuration : elapsed)}</Text>
          <TouchableOpacity
            onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
            style={styles.iconBtn}
            hitSlop={12}
            disabled={facing === 'front'}
          >
            <Ionicons
              name={flash === 'off' ? 'flash-off' : 'flash'}
              size={24}
              color={facing === 'front' ? '#666' : '#FFF'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.circleWrap}>
          <View style={styles.circle}>
            {previewUri ? (
              <Video
                source={{ uri: previewUri }}
                style={previewCoverStyle}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted={false}
                useNativeControls={false}
              />
            ) : permission?.granted ? (
              <CameraView
                ref={cameraRef}
                style={previewCoverStyle}
                facing={facing}
                flash={flash}
                mode="video"
                mirror={facing === 'front'}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewLabel}>Sin permiso de cámara</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                  <Text style={styles.permBtnText}>Permitir</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {isRecording && <View style={styles.recordingRing} />}
        </View>

        <View style={styles.controls}>
          {previewUri ? (
            <>
              <TouchableOpacity style={styles.sideBtn} onPress={handleRetake}>
                <Ionicons name="refresh" size={26} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isSending}>
                {isSending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Ionicons name="send" size={28} color="#FFF" />
                )}
              </TouchableOpacity>
              <View style={styles.sideBtn} />
            </>
          ) : (
            <>
              <View style={styles.sideBtn} />
              <TouchableOpacity
                onPress={handleShutterPress}
                style={[styles.shutterOuter, isRecording && styles.shutterOuterRecording]}
                activeOpacity={0.85}
              >
                <View style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sideBtn}
                onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
                disabled={isRecording}
              >
                <Ionicons name="camera-reverse" size={26} color="#FFF" />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.modeRow}>
          <View style={styles.modePill}>
            <Text style={styles.modeText}>Nota de video</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  circleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  recordingRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 12,
    height: CIRCLE_SIZE + 12,
    borderRadius: (CIRCLE_SIZE + 12) / 2,
    borderWidth: 3,
    borderColor: '#EF4444',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  previewLabel: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  permBtn: {
    marginTop: 8,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  permBtnText: {
    color: '#FFF',
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuterRecording: {
    borderColor: '#EF4444',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFF',
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  sendBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    alignItems: 'center',
    paddingBottom: 16,
  },
  modePill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
