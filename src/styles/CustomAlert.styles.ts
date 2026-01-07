/**
 * Custom Alert Styles
 * 
 * Modern alert dialog styles for CustomAlert component.
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const customAlertStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    androidOverlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    alertContainer: {
        width: Math.min(SCREEN_WIDTH - 64, 320),
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        fontSize: 15,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    buttonContainer: {
        width: '100%',
        gap: 10,
    },
    buttonContainerRow: {
        flexDirection: 'row-reverse',
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 100,
        flex: 1,
    },
    buttonDefault: {
        backgroundColor: '#F5F5F5',
    },
    buttonPrimary: {
        backgroundColor: '#25D366',
    },
    buttonCancel: {
        backgroundColor: '#F5F5F5',
    },
    buttonDestructive: {
        backgroundColor: '#FF3B30',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
    },
    buttonTextPrimary: {
        color: '#FFFFFF',
    },
    buttonTextCancel: {
        color: '#666666',
    },
    buttonTextDestructive: {
        color: '#FFFFFF',
    },
});
