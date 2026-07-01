import React from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCommunicationBoard } from '../hooks/useCommunicationBoard';
import { getStyles } from '../styles/CommunicationBoardScreen.styles';
import { useTheme } from '../contexts/ThemeContext';
import { MagicPencilIcon } from '../components/icons/ActionIcons';

interface CommunicationBoardScreenProps {
  onBack: () => void;
}

export const CommunicationBoardScreen: React.FC<CommunicationBoardScreenProps> = ({
  onBack,
}) => {
  const { colors, isDark } = useTheme();
  const {
    text,
    setText,
    isSpeaking,
    isCorrecting,
    isPaused,
    isListening,
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
  } = useCommunicationBoard(onBack);

  const styles = getStyles(colors, isDark);

  const renderTextWithHighlight = () => {
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    words.forEach((token, index) => {
      // Añadimos el espacio/texto que hay entre el token anterior y el actual
      if (token.start > lastIndex) {
        const interstitial = text.substring(lastIndex, token.start);
        elements.push(
          <Text key={`inter-${index}`} style={styles.sentenceText}>
            {interstitial}
          </Text>
        );
      }

      const isActive = index === currentWordIndex;
      elements.push(
        <Text
          key={`word-${index}`}
          style={[
            styles.sentenceText,
            isActive && styles.sentenceTextActive
          ]}
        >
          {token.word}
        </Text>
      );
      lastIndex = token.end;
    });

    // Añadimos cualquier texto que quede al final (espacios finales, etc.)
    if (lastIndex < text.length) {
      elements.push(
        <Text key="tail" style={styles.sentenceText}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return (
      <Text style={styles.textDisplay}>
        {elements}
      </Text>
    );
  };

  const isPlayingOrPaused = isSpeaking || isPaused;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Pizarra de Comunicación</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!isPlayingOrPaused ? (
            <TextInput
              style={styles.textInput}
              placeholder="Escribe para hablar..."
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              value={text}
              onChangeText={setText}
            />
          ) : (
            <ScrollView 
              style={styles.displayScrollView}
              contentContainerStyle={styles.displayScrollViewContent}
            >
              {renderTextWithHighlight()}
            </ScrollView>
          )}
        </View>

        <View style={styles.footer}>
          {isPlayingOrPaused ? (
            <>
              <TouchableOpacity 
                style={[
                  styles.speakButton, 
                  isPaused && { backgroundColor: '#10B981' }
                ]} 
                onPress={handleSpeak}
              >
                <Ionicons name={isSpeaking ? "pause" : "play"} size={32} color="white" />
                <Text style={styles.speakButtonText}>
                  {isSpeaking ? 'Pausar' : 'Continuar'}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionButton} onPress={handleStop}>
                  <Ionicons name="square" size={28} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Detener</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.actionButton, 
                    !hasNextSentence && { opacity: 0.4 }
                  ]} 
                  onPress={handleNextSentence}
                  disabled={!hasNextSentence}
                >
                  <Ionicons name="play-skip-forward" size={28} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Avanzar</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.speakButton, !text.trim() && { opacity: 0.6 }]} 
                onPress={handleSpeak}
                disabled={!text.trim()}
              >
                <Ionicons name="volume-high" size={32} color="white" />
                <Text style={styles.speakButtonText}>Hablar en voz alta</Text>
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[
                    styles.actionButton, 
                    isListening && styles.actionButtonActive
                  ]} 
                  onPress={isListening ? stopListening : startListening}
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={28} 
                    color={isListening ? "#EF4444" : colors.textSecondary} 
                  />
                  <Text style={[styles.actionText, isListening && { color: '#EF4444' }]}>
                    {isListening ? 'Escuchando' : 'Dictar por Voz'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleClear}>
                  <Ionicons name="trash-outline" size={28} color={colors.textSecondary} />
                  <Text style={styles.actionText}>Limpiar Texto</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.actionButton, 
                    (!text.trim() || isCorrecting) && { opacity: 0.4 }
                  ]} 
                  onPress={handleAICorrect}
                  disabled={isCorrecting || !text.trim()}
                >
                  {isCorrecting ? (
                    <ActivityIndicator size="small" color="#FF69B4" style={{ height: 28 }} />
                  ) : (
                    <MagicPencilIcon size={28} />
                  )}
                  <Text style={styles.actionText}>Corregir Español</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
