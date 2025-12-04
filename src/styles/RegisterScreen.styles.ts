import { StyleSheet, Platform } from 'react-native';

export const registerScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backArrow: {
    fontSize: 24,
    color: '#000000',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    borderRadius: 20,
    tintColor: '#FF0000', // Red tint as requested
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 24,
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30, // Matched LoginScreen
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '90%', // Matched LoginScreen
    alignSelf: 'center',
  },
  socialSection: {
    marginTop: 32,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 30, // Matched LoginScreen
    backgroundColor: '#83A98A', // Matched LoginScreen
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '90%',
    alignSelf: 'center',
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2E7D32', // Matched LoginScreen
  },
  separatorText: {
    marginHorizontal: 16,
    color: '#999999',
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  nextButton: {
    backgroundColor: '#376A3E', // Matched LoginScreen
    borderRadius: 30, // Matched LoginScreen
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '70%', // Matched LoginScreen
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
    width: '90%',
  },
  linkText: {
    color: '#000000',
    textDecorationLine: 'underline',
  },
});
