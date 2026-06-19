import React from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
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
    handleSpeak,
    handleAICorrect,
    handleClear,
    handleClose,
  } = useCommunicationBoard(onBack);

  const styles = getStyles(colors, isDark);

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
          <TextInput
            style={styles.textInput}
            placeholder="Escribe para hablar..."
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
          />
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[
              styles.speakButton, 
              isSpeaking && { backgroundColor: '#4338CA' }
            ]} 
            onPress={handleSpeak}
          >
            <Ionicons name={isSpeaking ? "stop-circle" : "volume-high"} size={32} color="white" />
            <Text style={styles.speakButtonText}>
              {isSpeaking ? 'Detener' : 'Hablar en voz alta'}
            </Text>
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
