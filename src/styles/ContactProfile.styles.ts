import { StyleSheet } from 'react-native';

/**
 * Styles for ContactProfileScreen component
 * WhatsApp-inspired contact profile design
 */
export const contactProfileStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        backgroundColor: '#075E54',
        paddingTop: 50,
        paddingBottom: 20,
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 16,
        padding: 8,
    },
    avatarLarge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#7FA889',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: '#FFFFFF',
    },
    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    headerName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerPhone: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    originalName: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: 4,
        fontStyle: 'italic',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    section: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#075E54',
        marginBottom: 12,
        textTransform: 'uppercase',
    },
    field: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    fieldValue: {
        fontSize: 16,
        color: '#1a1a1a',
    },
    fieldValueEmpty: {
        fontSize: 16,
        color: '#999',
        fontStyle: 'italic',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    inputDisabled: {
        backgroundColor: '#F0F0F0',
        color: '#999',
    },
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    phoneText: {
        fontSize: 16,
        color: '#1a1a1a',
        flex: 1,
    },
    phoneLock: {
        fontSize: 14,
        color: '#999',
    },
    editButton: {
        position: 'absolute',
        top: 50,
        right: 16,
        padding: 8,
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#25D366',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#E0E0E0',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
    addContactButton: {
        backgroundColor: '#25D366',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
    },
    addContactButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
