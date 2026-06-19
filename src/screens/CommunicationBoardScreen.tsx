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
    sentences,
    currentSentenceIndex,
    handleSpeak,
    handlePause,
    handleStop,
    handleNextSentence,
    handleAICorrect,
    handleClear,
    handleClose,
  } = useCommunicationBoard(onBack);

  const styles = getStyles(colors, isDark);

  const renderTextWithHighlight = () => {
    return (
      <Text style={styles.textDisplay}>
        {sentences.map((sentence, index) => {
          const isActive = index === currentSentenceIndex;
          return (
            <Text 
              key={index} 
              style={[
                styles.sentenceText,
                isActive && styles.sentenceTextActive
              ]}
            >
              {sentence}{' '}
            </Text>
          );
        })}
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
                    currentSentenceIndex >= sentences.length - 1 && { opacity: 0.4 }
                  ]} 
                  onPress={handleNextSentence}
                  disabled={currentSentenceIndex >= sentences.length - 1}
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
