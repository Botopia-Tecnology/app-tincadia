import { StyleSheet, Platform } from 'react-native';

export const registerScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  absoluteBackButton: {
    position: 'absolute',
    left: 0,
    top: 25,
    padding: 8,
  },
  backArrow: {
    fontSize: 32,
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
  logoArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  absoluteProgress: {
    position: 'absolute',
    right: 0,
    top: 25,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    tintColor: '#000000',
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
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    width: '90%', // Matched LoginScreen
    alignSelf: 'center',
    height: 56, // Fixed height for consistency
    justifyContent: 'center',
    // Shadows
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
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
    height: 56,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#376A3E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
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
  // Document Row Styles
  documentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    alignSelf: 'center',
    marginBottom: 16,
  },
  documentTypeContainer: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  documentTypeText: {
    fontSize: 16,
    color: '#000000',
  },
  documentTypePlaceholder: {
    color: '#999',
  },
  documentNumberInput: {
    width: '65%',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000000',
    height: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  dropdownItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 16,
    padding: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#376A3E',
    fontWeight: 'bold',
  },
});
