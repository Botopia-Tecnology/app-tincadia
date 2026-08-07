import { useState, useEffect, useRef } from 'react';
import { Alert, NativeModules, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import Voice from '@react-native-voice/voice';
import { chatService } from '../services/chat.service';
import { useSubscription } from './useSubscription';
import { APP_TIERS } from '../config/revenuecat.config';

export interface WordToken {
  word: string;
  cleanWord: string;
  start: number;
  end: number;
}

const tokenizeWords = (inputText: string): WordToken[] => {
  if (!inputText.trim()) return [];
  const tokens: WordToken[] = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(inputText)) !== null) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;
    // Limpiamos la puntuación para cálculos temporales precisos
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!]/g, "");
    tokens.push({
      word,
      cleanWord,
      start,
      end,
    });
  }
  return tokens;
};

const getNativeVoiceModule = () => NativeModules.Voice || NativeModules.RCTVoice;

const hasNativeVoiceModule = () => {
  const nativeVoiceModule = getNativeVoiceModule();
  return Boolean(nativeVoiceModule?.startSpeech);
};

export type CorrectionUpgradeFeature = 'correction' | 'correction_blocked';

export const useCommunicationBoard = (onClose?: () => void) => {
  const { planTier, canUseCorrection, recordCorrectionUse } = useSubscription();
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceRecognitionError, setVoiceRecognitionError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<CorrectionUpgradeFeature>('correction');

  // Estados del Karaoke por palabra
  const [words, setWords] = useState<WordToken[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isPaused, setIsPaused] = useState(false);

  const currentWordIndexRef = useRef(-1);
  const wordsRef = useRef<WordToken[]>([]);
  const isSpeakingRef = useRef(false);
  const androidTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!hasNativeVoiceModule()) {
      setVoiceRecognitionError('El dictado por voz no está disponible en esta versión instalada.');
      console.warn(
        'Voice recognition native module is unavailable. Expected NativeModules.Voice or NativeModules.RCTVoice.'
      );
      return;
    }

    // Configurar listeners de Voice para dictado por voz
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = (e: any) => {
      console.error('Speech recognition error:', e);
      setIsListening(false);
    };
    Voice.onSpeechResults = (e: any) => {
      if (e.value && e.value.length > 0) {
        setText(e.value[0]);
      }
    };
    Voice.onSpeechPartialResults = (e: any) => {
      if (e.value && e.value.length > 0) {
        setText(e.value[0]);
      }
    };

    return () => {
      if (androidTimerRef.current) {
        clearTimeout(androidTimerRef.current);
      }
      Speech.stop();
      Voice.destroy()
        .catch((error: unknown) => {
          console.warn('Failed to destroy voice recognition:', error);
        })
        .finally(() => {
          Voice.removeAllListeners();
        });
    };
  }, []);

  const runAndroidSpeechTimer = (activeIndex: number) => {
    if (androidTimerRef.current) {
      clearTimeout(androidTimerRef.current);
    }

    const list = wordsRef.current;
    if (activeIndex < 0 || activeIndex >= list.length) {
      return;
    }

    setCurrentWordIndex(activeIndex);
    currentWordIndexRef.current = activeIndex;

    const token = list[activeIndex];
    const baseMs = 80; // Duración base por palabra ajustada
    const msPerChar = 35; // Duración por letra en milisegundos ajustada
    let duration = baseMs + token.cleanWord.length * msPerChar;

    // Sumar pausas naturales de puntuación más breves para evitar desincronización
    const wordText = token.word;
    if (wordText.endsWith('.') || wordText.endsWith('?') || wordText.endsWith('!')) {
      duration += 200; // Fin de oración (antes 350)
    } else if (wordText.endsWith(',') || wordText.endsWith(';') || wordText.endsWith(':')) {
      duration += 80; // Pausa menor (antes 150)
    }

    androidTimerRef.current = setTimeout(() => {
      if (isSpeakingRef.current) {
        runAndroidSpeechTimer(activeIndex + 1);
      }
    }, duration);
  };

  const speakFromWord = (startIndex: number) => {
    const list = wordsRef.current;
    if (startIndex < 0 || startIndex >= list.length) {
      handleStop();
      return;
    }

    setCurrentWordIndex(startIndex);
    currentWordIndexRef.current = startIndex;

    if (androidTimerRef.current) {
      clearTimeout(androidTimerRef.current);
      androidTimerRef.current = null;
    }

    // Hablar el fragmento restante desde el inicio de la palabra actual
    const speechText = text.substring(list[startIndex].start);

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);

    Speech.speak(speechText, {
      language: 'es-ES',
      rate: 1.0,
      // El motor TTS tarda en inicializar (sobre todo la primera vez tras
      // abrir la app). En Android el karaoke es un temporizador estimado, así
      // que debe arrancar cuando el motor empieza a sonar de verdad, no al
      // llamar a speak(); si no, el amarillo avanza sobre silencio.
      onStart: () => {
        if (Platform.OS === 'android' && isSpeakingRef.current) {
          runAndroidSpeechTimer(startIndex);
        }
      },
      onBoundary: (event: any) => {
        if (Platform.OS === 'ios' && isSpeakingRef.current) {
          const relativeCharIndex = event.charIndex;
          const absoluteCharIndex = list[startIndex].start + relativeCharIndex;
          
          let activeIndex = startIndex;
          for (let i = startIndex; i < list.length; i++) {
            if (absoluteCharIndex >= list[i].start) {
              activeIndex = i;
            } else {
              break;
            }
          }
          
          setCurrentWordIndex(activeIndex);
          currentWordIndexRef.current = activeIndex;
        }
      },
      onDone: () => {
        if (isSpeakingRef.current) {
          handleStop();
        }
      },
      onStopped: () => {
        // No borramos estado para mantener registro de dónde se pausó
      },
      onError: (e) => {
        console.log('Error de TTS en índice', startIndex, e);
        if (isSpeakingRef.current) {
          handleStop();
        }
      }
    });
  };

  const handleSpeak = async () => {
    if (!text.trim()) return;
    
    if (isSpeaking) {
      await handlePause();
      return;
    }

    if (isPaused) {
      handleResume();
      return;
    }

    const tokens = tokenizeWords(text);
    if (tokens.length === 0) return;

    wordsRef.current = tokens;
    setWords(tokens);
    
    speakFromWord(0);
  };

  const handlePause = async () => {
    isSpeakingRef.current = false;
    if (androidTimerRef.current) {
      clearTimeout(androidTimerRef.current);
      androidTimerRef.current = null;
    }
    await Speech.stop();
    setIsSpeaking(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    const idx = currentWordIndexRef.current;
    if (idx < 0 || idx >= wordsRef.current.length) {
      speakFromWord(0);
    } else {
      speakFromWord(idx);
    }
  };

  const handleStop = async () => {
    isSpeakingRef.current = false;
    if (androidTimerRef.current) {
      clearTimeout(androidTimerRef.current);
      androidTimerRef.current = null;
    }
    await Speech.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
    currentWordIndexRef.current = -1;
  };

  const handleNextSentence = async () => {
    const list = wordsRef.current;
    const currentIdx = currentWordIndexRef.current;
    if (currentIdx < 0 || currentIdx >= list.length) return;

    let nextWordIndex = -1;
    for (let i = currentIdx; i < list.length; i++) {
      const wordText = list[i].word;
      if (wordText.endsWith('.') || wordText.endsWith('?') || wordText.endsWith('!')) {
        if (i + 1 < list.length) {
          nextWordIndex = i + 1;
        }
        break;
      }
      
      if (i + 1 < list.length) {
        const interstitial = text.substring(list[i].end, list[i + 1].start);
        if (interstitial.includes('\n')) {
          nextWordIndex = i + 1;
          break;
        }
      }
    }

    if (nextWordIndex === -1 || nextWordIndex >= list.length) {
      await handleStop();
      return;
    }

    isSpeakingRef.current = false;
    if (androidTimerRef.current) {
      clearTimeout(androidTimerRef.current);
      androidTimerRef.current = null;
    }
    await Speech.stop();

    setTimeout(() => {
      speakFromWord(nextWordIndex);
    }, 100);
  };

  const startListening = async () => {
    try {
      if (!hasNativeVoiceModule()) {
        const message = 'El dictado por voz no está disponible en esta versión instalada.';
        setVoiceRecognitionError(message);
        setIsListening(false);
        console.warn(
          'Voice recognition native module is unavailable. Expected NativeModules.Voice or NativeModules.RCTVoice.'
        );
        Alert.alert('Dictado no disponible', message);
        return;
      }

      if (isSpeaking) {
        await handleStop();
      }

      const isAvailable = await Voice.isAvailable();
      if (!isAvailable) {
        const message = 'Este dispositivo no tiene un servicio de reconocimiento de voz disponible.';
        setVoiceRecognitionError(message);
        setIsListening(false);
        console.warn(message);
        Alert.alert('Dictado no disponible', message);
        return;
      }

      setVoiceRecognitionError(null);
      setIsListening(true);
      await Voice.start('es-ES');
    } catch (e) {
      console.error('Failed to start voice recognition:', e);
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    try {
      if (!hasNativeVoiceModule()) {
        setIsListening(false);
        return;
      }

      await Voice.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Failed to stop voice recognition:', e);
    }
  };

  const handleAICorrect = async () => {
    if (!text.trim() || isCorrecting) return;

    if (!canUseCorrection()) {
      setUpgradeFeature(planTier === APP_TIERS.GRATIS ? 'correction_blocked' : 'correction');
      setShowUpgradeModal(true);
      return;
    }

    setIsCorrecting(true);
    try {
      const { correctedText } = await chatService.correctMessage(text);
      if (correctedText) {
        setText(correctedText);
        recordCorrectionUse();
      }
    } catch (error) {
      console.error('Error al corregir texto con IA:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleClear = () => {
    setText('');
    handleStop();
    if (isListening) {
      stopListening();
    }
  };

  const handleClose = () => {
    handleStop();
    if (isListening) {
      stopListening();
    }
    onClose?.();
  };

  const hasNextSentence = (() => {
    const list = words;
    const currentIdx = currentWordIndex;
    if (currentIdx < 0 || currentIdx >= list.length) return false;

    for (let i = currentIdx; i < list.length; i++) {
      const wordText = list[i].word;
      if (wordText.endsWith('.') || wordText.endsWith('?') || wordText.endsWith('!')) {
        return (i + 1 < list.length);
      }
      if (i + 1 < list.length) {
        const interstitial = text.substring(list[i].end, list[i + 1].start);
        if (interstitial.includes('\n')) {
          return true;
        }
      }
    }
    return false;
  })();

  return {
    text,
    setText,
    isSpeaking,
    isCorrecting,
    isPaused,
    isListening,
    voiceRecognitionError,
    words,
    currentWordIndex,
    hasNextSentence,
    handleSpeak,
    handlePause,
    handleStop,
    handleNextSentence,
    handleAICorrect,
    handleClear,
    handleClose,
    startListening,
    stopListening,
    showUpgradeModal,
    upgradeFeature,
    dismissUpgradeModal: () => setShowUpgradeModal(false),
  };
};
