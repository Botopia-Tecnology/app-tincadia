import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  type LayoutChangeEvent,
  type TextLayoutEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCommunicationBoard } from '../hooks/useCommunicationBoard';
import { getStyles } from '../styles/CommunicationBoardScreen.styles';
import { useTheme } from '../contexts/ThemeContext';
import { MagicPencilIcon } from '../components/icons/ActionIcons';
import { UpgradeModal } from '../components/UpgradeModal';
import { NavigateFunction } from '../types/navigation.types';

interface CommunicationBoardScreenProps {
  onBack: () => void;
  onNavigate?: NavigateFunction;
}

export const CommunicationBoardScreen: React.FC<CommunicationBoardScreenProps> = ({
  onBack,
  onNavigate,
}) => {
  const { colors, isDark } = useTheme();
  const {
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
    dismissUpgradeModal,
  } = useCommunicationBoard(onBack);

  // Sin memo esto reconstruye todos los estilos en cada avance del karaoke (20
  // veces por segundo) y, al devolver objetos nuevos, anula el React.memo de
  // las palabras: se repintaba el texto entero y los botones se sentían lentos.
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const isPlayingOrPaused = isSpeaking || isPaused;

  // ── Auto-scroll del karaoke ──
  // El texto resaltado se renderiza como <Text> anidados dentro de un <Text>
  // padre (tres: antes, palabra activa, después). Los <Text> anidados no
  // reportan onLayout de forma fiable (en Android directamente no se dispara),
  // así que no se puede medir la palabra activa.
  // En su lugar se usa onTextLayout, que entrega las líneas YA calculadas por el
  // motor nativo: para cada línea, su texto y su posición `y` real. Con eso se
  // mapea palabra -> línea sin estimar anchos ni depender de la fuente.
  const scrollRef = useRef<ScrollView>(null);
  // Offset `y` del inicio de cada línea, indexado por línea.
  const lineOffsetsRef = useRef<number[]>([]);
  // Índice de la primera palabra (posición en `text`) que abre cada línea.
  const lineStartCharsRef = useRef<number[]>([]);
  const viewportHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const lastScrolledLineRef = useRef(-1);
  // Las medidas llegan por eventos nativos (refs), que no re-disparan el efecto.
  // Si el layout llega DESPUÉS de que la palabra activa ya cambió —al arrancar,
  // o al usar "Avanzar" antes del primer layout— sin esto el scroll se perdería.
  const [layoutVersion, setLayoutVersion] = useState(0);

  const handleViewportLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
    setLayoutVersion((v) => v + 1);
  }, []);

  const handleTextLayout = useCallback((event: TextLayoutEvent) => {
    const lines = event.nativeEvent.lines;
    const offsets: number[] = [];
    const startChars: number[] = [];

    // `line.text` reconstruye el contenido en orden, así que acumular su
    // longitud da el índice de carácter donde arranca cada línea. Se compara
    // contra token.start (mismo espacio de índices que `text`).
    let charCursor = 0;
    for (const line of lines) {
      offsets.push(line.y);
      startChars.push(charCursor);
      charCursor += line.text.length;
    }

    // onTextLayout se dispara en cada avance del karaoke, porque resaltar una
    // palabra cambia los hijos del <Text> padre. Como el resaltado no altera
    // métricas, la geometría es idéntica entre palabras: salir aquí evita un
    // setLayoutVersion (y su re-render) por cada palabra del texto. Solo
    // reaccionamos cuando cambia de verdad (rotación, edición del texto).
    const previous = lineOffsetsRef.current;
    const sameLayout =
      previous.length === offsets.length &&
      previous.every((y, i) => y === offsets[i]) &&
      lineStartCharsRef.current.every((c, i) => c === startChars[i]);

    if (sameLayout) return;

    lineOffsetsRef.current = offsets;
    lineStartCharsRef.current = startChars;
    // Un relayout (rotación, cambio de texto) invalida el último scroll hecho:
    // hay que reposicionar sobre las líneas nuevas aunque el índice no cambie.
    lastScrolledLineRef.current = -1;
    setLayoutVersion((v) => v + 1);
  }, []);

  const handleContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
  }, []);

  // Al salir de reproducción el ScrollView se desmonta y sus medidas dejan de
  // ser válidas. Sin este reset, una reproducción posterior que arranque en la
  // misma línea se saltaría el scroll inicial por el guard de deduplicación.
  useEffect(() => {
    if (isPlayingOrPaused) return;
    lastScrolledLineRef.current = -1;
    lineOffsetsRef.current = [];
    lineStartCharsRef.current = [];
    contentHeightRef.current = 0;
  }, [isPlayingOrPaused]);

  useEffect(() => {
    if (!isPlayingOrPaused) return;

    const token = words[currentWordIndex];
    if (!token) return;

    const lineStarts = lineStartCharsRef.current;
    const offsets = lineOffsetsRef.current;
    if (lineStarts.length === 0 || offsets.length === 0) return;

    // Última línea cuyo primer carácter no supera el inicio de la palabra.
    let lineIndex = 0;
    for (let i = 0; i < lineStarts.length; i++) {
      if (lineStarts[i] <= token.start) lineIndex = i;
      else break;
    }

    // Sin esto, cada palabra de la misma línea repetiría el scrollTo.
    if (lineIndex === lastScrolledLineRef.current) return;
    lastScrolledLineRef.current = lineIndex;

    const viewportHeight = viewportHeightRef.current;
    if (viewportHeight <= 0) return;

    // Se mantiene la línea activa a un tercio de la altura visible: deja
    // contexto de lo ya leído arriba y anticipa lo que viene abajo.
    const lineY = offsets[lineIndex];
    let target = lineY - viewportHeight / 3;

    // Sin clamp, scrollTo con un offset mayor al máximo provoca rebote al
    // final del texto en iOS. Solo se aplica si ya se midió el contenido:
    // con contentHeight aún en 0 el clamp forzaría target = 0.
    if (contentHeightRef.current > 0) {
      const maxOffset = Math.max(0, contentHeightRef.current - viewportHeight);
      target = Math.min(target, maxOffset);
    }
    target = Math.max(0, target);

    // Sin animar: una animación de scroll por cada cambio de línea compite con
    // los ticks del karaoke por el hilo de UI en textos largos.
    scrollRef.current?.scrollTo({ y: target, animated: false });
  }, [currentWordIndex, words, isPlayingOrPaused, layoutVersion]);

  // El texto se parte en TRES nodos (antes / palabra activa / después) en vez
  // de uno por palabra. Con un nodo por palabra, cada avance del karaoke
  // reconstruía y reconciliaba los N nodos y el motor nativo remedía el bloque
  // entero: recorrer un texto de N palabras costaba O(N²) y en textos largos
  // ahogaba el hilo de UI (subrayado a trompicones y móvil lento). Así el coste
  // de cada avance es constante, no depende de la longitud del texto.
  const activeToken = currentWordIndex >= 0 ? words[currentWordIndex] : undefined;

  const renderTextWithHighlight = () => {
    if (!activeToken) {
      return (
        <Text
          style={[styles.textDisplay, styles.sentenceText]}
          onTextLayout={handleTextLayout}
        >
          {text}
        </Text>
      );
    }

    return (
      <Text style={styles.textDisplay} onTextLayout={handleTextLayout}>
        <Text style={styles.sentenceText}>{text.substring(0, activeToken.start)}</Text>
        <Text style={styles.sentenceTextActive}>
          {text.substring(activeToken.start, activeToken.end)}
        </Text>
        <Text style={styles.sentenceText}>{text.substring(activeToken.end)}</Text>
      </Text>
    );
  };

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
              ref={scrollRef}
              style={styles.displayScrollView}
              contentContainerStyle={styles.displayScrollViewContent}
              onLayout={handleViewportLayout}
              onContentSizeChange={handleContentSizeChange}
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
                  <Ionicons name="square" size={24} color={colors.textSecondary} />
                  <Text style={styles.actionText} numberOfLines={2}>Detener</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.actionButton, 
                    !hasNextSentence && { opacity: 0.4 }
                  ]} 
                  onPress={handleNextSentence}
                  disabled={!hasNextSentence}
                >
                  <Ionicons name="play-skip-forward" size={24} color={colors.textSecondary} />
                  <Text style={styles.actionText} numberOfLines={2}>Avanzar</Text>
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
                    isListening && styles.actionButtonActive,
                    voiceRecognitionError && !isListening && { opacity: 0.45 }
                  ]} 
                  onPress={isListening ? stopListening : startListening}
                  disabled={Boolean(voiceRecognitionError) && !isListening}
                >
                  <Ionicons 
                    name={voiceRecognitionError && !isListening ? "mic-off-outline" : isListening ? "mic" : "mic-outline"} 
                    size={24} 
                    color={isListening ? "#EF4444" : colors.textSecondary} 
                  />
                  <Text style={[styles.actionText, isListening && { color: '#EF4444' }]} numberOfLines={2}>
                    {isListening ? 'Escuchando' : voiceRecognitionError ? 'Dictado no disponible' : 'Dictar por Voz'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton} onPress={handleClear}>
                  <Ionicons name="trash-outline" size={24} color={colors.textSecondary} />
                  <Text style={styles.actionText} numberOfLines={2}>Limpiar Texto</Text>
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
                    <ActivityIndicator size="small" color="#FF69B4" style={{ height: 24 }} />
                  ) : (
                    <MagicPencilIcon size={24} />
                  )}
                  <Text style={styles.actionText} numberOfLines={2}>Corregir Español</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={showUpgradeModal}
        onClose={dismissUpgradeModal}
        feature={upgradeFeature}
        onUpgradePress={() => {
          dismissUpgradeModal();
          onNavigate?.('profile', { openManagePlan: true });
        }}
      />
    </SafeAreaView>
  );
};
