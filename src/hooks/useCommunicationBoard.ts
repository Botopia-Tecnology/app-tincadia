import { useState, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { chatService } from '../services/chat.service';

export const useCommunicationBoard = (onClose?: () => void) => {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSpeak = async () => {
    if (!text.trim()) return;
    
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    
    Speech.speak(text, {
      language: 'es-ES',
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
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
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
  };

  const handleClose = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
    onClose?.();
  };

  return {
    text,
    setText,
    isSpeaking,
    isCorrecting,
    handleSpeak,
    handleAICorrect,
    handleClear,
    handleClose,
  };
};
