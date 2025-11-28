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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 16,
    borderRadius: 30,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 1,
  },
  formContainer: {
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '90%',
    alignSelf: 'center',
  },
  registerButton: {
    backgroundColor: '#376A3E',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    alignSelf: 'center',
    width: '70%',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLinkContainer: {
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#2E7D32',
  },
  loginLink: {
    fontWeight: '600',
  },
  separator: {
    marginVertical: 32,
    alignItems: 'center',
  },
  separatorLine: {
    width: '70%',
    height: 1,
    backgroundColor: '#2E7D32',
    alignSelf: 'center',
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  socialButton: {
    width: 56,
    height: 56,
    borderRadius: 30,
    backgroundColor: '#83A98A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
