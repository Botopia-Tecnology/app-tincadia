import { useState, useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import { chatService } from '../services/chat.service';

const parseSentences = (inputText: string): string[] => {
  if (!inputText.trim()) return [];
  // Divide el texto por signos de puntuación o saltos de línea manteniendo el delimitador
  return inputText
    .split(/([.!?\n]+)/)
    .reduce<string[]>((acc, part, i) => {
      if (i % 2 === 0) {
        if (part.trim()) {
          acc.push(part);
        }
      } else {
        if (acc.length > 0) {
          acc[acc.length - 1] += part;
        }
      }
      return acc;
    }, [])
    .map(s => s.trim())
    .filter(Boolean);
};

export const useCommunicationBoard = (onClose?: () => void) => {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Estados del Karaoke
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1);
  const [isPaused, setIsPaused] = useState(false);

  const currentIndexRef = useRef(-1);
  const sentencesRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speakSentence = (index: number, list: string[]) => {
    if (index < 0 || index >= list.length) {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentSentenceIndex(-1);
      isSpeakingRef.current = false;
      currentIndexRef.current = -1;
      return;
    }

    setCurrentSentenceIndex(index);
    currentIndexRef.current = index;

    Speech.speak(list[index], {
      language: 'es-ES',
      onDone: () => {
        if (isSpeakingRef.current) {
          speakSentence(index + 1, list);
        }
      },
      onStopped: () => {
        // Detenido por pausa o stop
      },
      onError: (e) => {
        console.error('TTS error on sentence', index, e);
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentSentenceIndex(-1);
        isSpeakingRef.current = false;
        currentIndexRef.current = -1;
      }
    });
  };

  const handleSpeak = async () => {
    if (!text.trim()) return;
    
    if (isSpeaking) {
      // Si está hablando y presionan el botón principal, se pausa
      await handlePause();
      return;
    }

    if (isPaused) {
      // Si está en pausa, reanudamos
      handleResume();
      return;
    }

    // Si no está reproduciendo, iniciamos desde el principio
    const parsed = parseSentences(text);
    if (parsed.length === 0) return;

    sentencesRef.current = parsed;
    setSentences(parsed);
    
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);
    
    speakSentence(0, parsed);
  };

  const handlePause = async () => {
    isSpeakingRef.current = false;
    await Speech.stop();
    setIsSpeaking(false);
    setIsPaused(true);
  };

  const handleResume = () => {
    if (currentIndexRef.current < 0 || currentIndexRef.current >= sentencesRef.current.length) return;

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    setIsPaused(false);
    speakSentence(currentIndexRef.current, sentencesRef.current);
  };

  const handleStop = async () => {
    isSpeakingRef.current = false;
    await Speech.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentSentenceIndex(-1);
    currentIndexRef.current = -1;
  };

  const handleNextSentence = async () => {
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= sentencesRef.current.length) {
      await handleStop();
      return;
    }

    isSpeakingRef.current = false;
    await Speech.stop();

    // Pequeño timeout para que el motor nativo procese la parada antes de la siguiente reproducción
    setTimeout(() => {
      setIsSpeaking(true);
      isSpeakingRef.current = true;
      setIsPaused(false);
      speakSentence(nextIndex, sentencesRef.current);
    }, 100);
  };

  const handleAICorrect = async () => {
    if (!text.trim() || isCorrecting) return;

    setIsCorrecting(true);
    try {
      await chatService.correctMessageStream(text, (partialText) => {
        setText(partialText);
      });
    } catch (error) {
      console.error('Error al corregir texto con IA:', error);
    } finally {
      setIsCorrecting(false);
    }
  };

  const handleClear = () => {
    setText('');
    handleStop();
  };

  const handleClose = () => {
    handleStop();
    onClose?.();
  };

  return {
    text,
    setText,
    isSpeaking,
    isCorrecting,
    isPaused,
    sentences,
    currentSentenceIndex,
    handleSpeak,
    handlePause,
    handleStop,
    handleNextSentence,
    handleAICorrect,
    handleClear,
    handleClose,
  };
};
