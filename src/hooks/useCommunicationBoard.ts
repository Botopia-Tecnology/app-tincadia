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
  const androidScheduleRef = useRef<number[]>([]);
  const androidStartAtRef = useRef(0);
  const androidStartIndexRef = useRef(0);
  const androidChunkWeightRef = useRef(1);
  const androidChunksRef = useRef<{ start: number; end: number }[]>([]);
  const androidChunkPosRef = useRef(0);
  // Cuánto más lento va el motor TTS respecto a getWordDurationMs. Arranca en 1
  // (tomar la estimación como buena) y se corrige midiendo cada fragmento.
  const androidRateRef = useRef(1);
  const androidCalibratedRef = useRef(false);

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
        clearInterval(androidTimerRef.current);
        androidTimerRef.current = null;
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

  // Las palabras duran ~300-600 ms, así que muestrear cada 100 ms basta para
  // que el cambio se vea inmediato y deja el hilo JS libre para los botones.
  const ANDROID_TICK_MS = 100;

  // Retraso típico entre que el motor calla y llega onDone. Se descuenta al
  // calibrar para no inflar el ritmo medido.
  const ANDROID_DONE_LATENCY_MS = 120;

  const getWordDurationMs = (token: WordToken) => {
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

    return duration;
  };

  const stopAndroidSpeechTimer = () => {
    if (androidTimerRef.current) {
      clearInterval(androidTimerRef.current);
      androidTimerRef.current = null;
    }
  };

  // Android no emite onBoundary, así que el karaoke se estima. Para que la
  // estimación no se separe de la voz en textos largos, el texto se habla por
  // fragmentos (una frase por llamada a speak) y el onDone de cada fragmento
  // reancla el reloj sobre un punto real conocido. Dentro del fragmento se
  // interpola por peso de cada palabra, un tramo corto donde el error no se
  // acumula lo suficiente como para notarse.
  const buildAndroidChunks = (startIndex: number) => {
    const list = wordsRef.current;
    const chunks: { start: number; end: number }[] = [];
    let chunkStart = startIndex;

    for (let i = startIndex; i < list.length; i++) {
      const wordText = list[i].word;
      const endsSentence =
        wordText.endsWith('.') || wordText.endsWith('?') || wordText.endsWith('!');

      let breaksLine = false;
      if (i + 1 < list.length) {
        const interstitial = text.substring(list[i].end, list[i + 1].start);
        breaksLine = interstitial.includes('\n');
      }

      // Un fragmento demasiado largo vuelve a acumular deriva interna; uno
      // demasiado corto entrecorta la voz entre llamadas al motor. También se
      // corta en comas: en textos largos las frases pueden ser muy extensas y
      // sin este corte el reloj interpola demasiadas palabras sin reanclarse.
      const endsClause =
        wordText.endsWith(',') || wordText.endsWith(';') || wordText.endsWith(':');
      const longEnough = i - chunkStart >= 6;
      const tooLong = i - chunkStart >= 14;

      if (endsSentence || breaksLine || tooLong || (endsClause && longEnough)) {
        chunks.push({ start: chunkStart, end: i });
        chunkStart = i + 1;
      }
    }

    // Resto sin cierre de frase al final del texto
    if (chunkStart < list.length) {
      chunks.push({ start: chunkStart, end: list.length - 1 });
    }

    return chunks;
  };

  // Avanza el subrayado dentro de un fragmento repartiendo la duración entre
  // las palabras según su peso. El ritmo (ms por unidad de peso) no se estima:
  // se mide con el primer fragmento que termina y se reutiliza para el resto,
  // que es lo que mantiene el amarillo pegado a la voz real del motor.
  const runAndroidChunkTimer = (chunkStart: number, chunkEnd: number) => {
    stopAndroidSpeechTimer();

    const list = wordsRef.current;
    if (chunkStart < 0 || chunkStart >= list.length) return;

    const lastIndex = Math.min(chunkEnd, list.length - 1);

    // cumulative[i] = peso acumulado hasta terminar la palabra chunkStart + i
    const cumulative: number[] = [];
    let acc = 0;
    for (let i = chunkStart; i <= lastIndex; i++) {
      acc += getWordDurationMs(list[i]);
      cumulative.push(acc);
    }

    androidScheduleRef.current = cumulative;
    androidStartIndexRef.current = chunkStart;
    androidStartAtRef.current = Date.now();
    androidChunkWeightRef.current = acc;

    setCurrentWordIndex(chunkStart);
    currentWordIndexRef.current = chunkStart;

    androidTimerRef.current = setInterval(() => {
      if (!isSpeakingRef.current) {
        stopAndroidSpeechTimer();
        return;
      }

      const sched = androidScheduleRef.current;
      const elapsedMs = Date.now() - androidStartAtRef.current;
      // Reescalamos el tiempo real a la escala de la estimación: si el motor va
      // el doble de lento (rate = 2), 1000 ms reales equivalen a 500 estimados.
      const estimatedElapsed = elapsedMs / androidRateRef.current;

      // Primera palabra que aún no ha terminado según el reloj. Si el tiempo
      // ya superó todo el fragmento nos quedamos en la última: onDone es quien
      // manda avanzar, así el amarillo nunca adelanta a la voz.
      let offset = sched.length - 1;
      for (let i = 0; i < sched.length; i++) {
        if (estimatedElapsed < sched[i]) {
          offset = i;
          break;
        }
      }

      // Nos quedamos en la última palabra del fragmento hasta que onDone
      // confirme el final real y salte al siguiente: así el amarillo nunca
      // adelanta a la voz aunque el ritmo medido se quede corto.
      const activeIndex = Math.min(androidStartIndexRef.current + offset, lastIndex);
      if (activeIndex !== currentWordIndexRef.current) {
        setCurrentWordIndex(activeIndex);
        currentWordIndexRef.current = activeIndex;
      }
    }, ANDROID_TICK_MS);
  };

  // Compara lo que tardó de verdad el fragmento con lo que estimamos y guarda
  // el ratio (adimensional: >1 significa que el motor va más lento que la
  // estimación). El reloj divide por él, así que las unidades deben ser
  // ms reales / ms estimados, no ms por palabra.
  const calibrateAndroidRate = () => {
    const estimatedMs = androidChunkWeightRef.current;
    if (estimatedMs <= 0) return;

    const realMs = Date.now() - androidStartAtRef.current;
    // Un fragmento demasiado corto no da una medida fiable
    if (realMs < 150) return;

    // onDone llega algo después de que el audio calle. Sin descontar esa
    // latencia el ratio sale inflado en CADA fragmento y, al promediarse una y
    // otra vez, deriva hasta el tope: el subrayado se queda parado dentro del
    // fragmento y solo salta al cambiar de frase.
    const observed = Math.max(0, realMs - ANDROID_DONE_LATENCY_MS) / estimatedMs;
    const previous = androidRateRef.current;
    // Peso bajo a la medida nueva: corrige el sesgo global sin que un fragmento
    // suelto mueva el ritmo de golpe.
    const blended = androidCalibratedRef.current
      ? previous * 0.85 + observed * 0.15
      : previous * 0.5 + observed * 0.5;

    // Acotado para que una medida anómala no congele ni dispare el subrayado
    androidRateRef.current = Math.min(1.6, Math.max(0.6, blended));
    androidCalibratedRef.current = true;
  };

  // iOS habla todo el texto de una vez y sincroniza con onBoundary, que da la
  // posición real del motor. Android no tiene onBoundary, así que se apoya en
  // speakAndroidChunk.
  const speakWholeIOS = (startIndex: number) => {
    const list = wordsRef.current;
    const speechText = text.substring(list[startIndex].start);

    Speech.speak(speechText, {
      language: 'es-ES',
      rate: 1.0,
      onBoundary: (event: any) => {
        if (!isSpeakingRef.current) return;
        const absoluteCharIndex = list[startIndex].start + event.charIndex;

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
      },
    });
  };

  const speakAndroidChunk = (chunkPos: number) => {
    const chunks = androidChunksRef.current;
    if (chunkPos >= chunks.length) {
      handleStop();
      return;
    }

    androidChunkPosRef.current = chunkPos;

    const list = wordsRef.current;
    const { start, end } = chunks[chunkPos];
    const speechText = text.substring(list[start].start, list[end].end);

    // El temporizador arranca YA, no en onStart: en Android onStart no llega de
    // forma fiable por fragmento, y cuando no llegaba el karaoke no avanzaba
    // nada — solo se pintaba la primera palabra de cada frase y el resaltado
    // parecía saltar de frase en frase.
    runAndroidChunkTimer(start, end);

    Speech.speak(speechText, {
      language: 'es-ES',
      rate: 1.0,
      // Si el motor sí avisa, reancla el reloj al momento real en que empieza
      // a sonar (la primera vez tras abrir la app tarda en inicializar).
      onStart: () => {
        if (isSpeakingRef.current) {
          androidStartAtRef.current = Date.now();
        }
      },
      // Punto de sincronización real: al acabar el fragmento sabemos con
      // certeza dónde está la voz, así que el siguiente arranca sin arrastrar
      // el error del anterior.
      onDone: () => {
        if (!isSpeakingRef.current) return;
        // Algunos motores emiten onDone más de una vez por fragmento; sin esta
        // guarda se saltarían frases enteras.
        if (androidChunkPosRef.current !== chunkPos) return;
        stopAndroidSpeechTimer();
        // Antes de pasar al siguiente, aprendemos cuánto tardó de verdad este
        calibrateAndroidRate();
        speakAndroidChunk(chunkPos + 1);
      },
      onStopped: () => {
        // No borramos estado para mantener registro de dónde se pausó
      },
      onError: (e) => {
        console.log('Error de TTS en fragmento', chunkPos, e);
        if (isSpeakingRef.current) {
          handleStop();
        }
      },
    });
  };

  const speakFromWord = (startIndex: number) => {
    const list = wordsRef.current;
    if (startIndex < 0 || startIndex >= list.length) {
      handleStop();
      return;
    }

    setCurrentWordIndex(startIndex);
    currentWordIndexRef.current = startIndex;

    stopAndroidSpeechTimer();

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);

    if (Platform.OS === 'android') {
      androidChunksRef.current = buildAndroidChunks(startIndex);
      speakAndroidChunk(0);
    } else {
      speakWholeIOS(startIndex);
    }
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
    stopAndroidSpeechTimer();
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
    stopAndroidSpeechTimer();
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
    stopAndroidSpeechTimer();
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
