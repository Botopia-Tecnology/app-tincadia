import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Vibration, Platform } from 'react-native';
import { PhoneIcon } from './icons/NavigationIcons';

interface IncomingCallModalProps {
    visible: boolean;
    callerName: string;
    onAccept: () => void;
    onDecline: () => void;
    subtitle?: string; // Optional custom subtitle
    acceptText?: string; // Optional custom accept button text
    declineText?: string; // Optional custom decline button text
}

export const IncomingCallModal = ({
    visible,
    callerName,
    onAccept,
    onDecline,
    subtitle = 'Llamada entrante de Tincadia...',
    acceptText = 'Contestar',
    declineText = 'Rechazar'
}: IncomingCallModalProps) => {
    const vibrationInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible) {
            // Start vibration loop
            const ONE_SECOND_IN_MS = 1000;
            const PATTERN = [1000, 2000, 1000, 2000]; // Vibrate 1s, pause 2s

            if (Platform.OS === 'android') {
                Vibration.vibrate(PATTERN, true);
            } else {
                // iOS vibration loop
                const startVibration = () => {
                    Vibration.vibrate(ONE_SECOND_IN_MS);
                    vibrationInterval.current = setInterval(() => {
                        Vibration.vibrate(ONE_SECOND_IN_MS);
                    }, 3000);
                };
                startVibration();
            }
        } else {
            // Stop vibration
            Vibration.cancel();
            if (vibrationInterval.current) {
                clearInterval(vibrationInterval.current);
                vibrationInterval.current = null;
            }
        }

        return () => {
            Vibration.cancel();
            if (vibrationInterval.current) {
                clearInterval(vibrationInterval.current);
            }
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onDecline}
        >
            <View style={styles.container}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.9)' }]} />

                <View style={styles.content}>
                    <View style={styles.avatarContainer}>
                        <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
                    </View>

                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.callStatus}>{subtitle}</Text>

                    <View style={styles.actions}>
                        <View style={styles.actionButtonContainer}>
                            <TouchableOpacity style={[styles.button, styles.declineButton]} onPress={onDecline}>
                                <PhoneIcon size={32} color="white" />
                            </TouchableOpacity>
                            <Text style={styles.buttonText}>{declineText}</Text>
                        </View>

                        <View style={styles.actionButtonContainer}>
                            <TouchableOpacity style={[styles.button, styles.acceptButton]} onPress={onAccept}>
                                <PhoneIcon size={32} color="white" />
                            </TouchableOpacity>
                            <Text style={styles.buttonText}>{acceptText}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 40,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarText: {
        fontSize: 48,
        color: 'white',
        fontWeight: 'bold',
    },
    callerName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    callStatus: {
        fontSize: 18,
        color: '#9CA3AF',
        marginBottom: 60,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    actionButtonContainer: {
        alignItems: 'center',
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    declineButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EF4444',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    buttonText: {
        color: 'white',
        marginTop: 12,
        fontSize: 14,
        fontWeight: '500',
    }
});
