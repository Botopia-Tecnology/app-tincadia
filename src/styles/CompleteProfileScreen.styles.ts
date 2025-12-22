import { StyleSheet } from 'react-native';

/**
 * Styles for CompleteProfileScreen component
 */
export const completeProfileStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
    },
    errorContainer: {
        backgroundColor: '#FFE5E5',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FF4444',
    },
    errorText: {
        color: '#CC0000',
        fontSize: 14,
    },
    errorDismiss: {
        color: '#999',
        fontSize: 12,
        marginTop: 4,
    },
    form: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    select: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    selectText: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    selectPlaceholder: {
        fontSize: 16,
        color: '#999',
    },
    selectArrow: {
        fontSize: 12,
        color: '#666',
    },
    submitButton: {
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52,
    },
    submitButtonDisabled: {
        backgroundColor: '#A5D6A7',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        width: '80%',
        maxWidth: 300,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    modalItemText: {
        fontSize: 16,
        color: '#333',
        textAlign: 'center',
    },
});
