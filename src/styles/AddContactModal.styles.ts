import { StyleSheet, Platform, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Styles for AddContactModal component
 */
export const addContactModalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: SCREEN_HEIGHT * 0.85,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
    },
    closeIcon: {
        fontSize: 16,
        color: '#666666',
        fontWeight: '600',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#FAFAFA',
    },
    floatingLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        color: '#000000',
        padding: 0,
        margin: 0,
    },
    phoneRow: {
        flexDirection: 'row',
        gap: 12,
    },
    countryInput: {
        flex: 0.35,
    },
    phoneInput: {
        flex: 0.65,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    countryText: {
        fontSize: 16,
        color: '#000000',
    },
    dropdownArrow: {
        fontSize: 10,
        color: '#666666',
        marginLeft: 8,
    },
    errorContainer: {
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderRadius: 8,
        padding: 12,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: '#376A3E',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#376A3E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    saveButtonDisabled: {
        backgroundColor: '#A5D6A7',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
