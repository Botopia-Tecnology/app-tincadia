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
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 16,
    minWidth: 100,
  },
  actionText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  speakButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 24,
  },
  speakButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 12,
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
    color: colors.text,
    lineHeight: 56,
  },
  sentenceText: {
    color: colors.text,
  },
  sentenceTextActive: {
    backgroundColor: '#FEF08A',
    color: '#000000',
  }
});
