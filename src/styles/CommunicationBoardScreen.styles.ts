import { StyleSheet, Platform } from 'react-native';

export const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  textInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '500',
    color: colors.text,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    minWidth: 0,
  },
  actionButtonActive: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
  },
  actionText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    flexShrink: 1,
  },
  speakButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  speakButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  displayScrollView: {
    flex: 1,
  },
  displayScrollViewContent: {
    flexGrow: 1,
  },
  textDisplay: {
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 56,
  },
  sentenceText: {
    color: colors.text,
    opacity: 0.3,
  },
  // Solo color/opacidad: cambiar fontWeight altera el ancho de la palabra y
  // obliga al motor nativo a recalcular el flujo del texto ENTERO en cada
  // avance del karaoke. En textos largos eso bloquea el hilo de UI (subrayado
  // congelado y botones lentos). El contraste lo da el salto de opacidad
  // 0.3 -> 1 más el amarillo, sin tocar la métrica.
  sentenceTextActive: {
    color: '#EAB308',
    opacity: 1,
  }
});
