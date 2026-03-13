import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Vibration, Platform, Image } from 'react-native';
import { PhoneIcon } from './icons/NavigationIcons';

interface Participant {
    id: string;
    name: string;
    avatar?: string;
}

interface IncomingCallModalProps {
    visible: boolean;
    callerName: string;
    callerPhoto?: string; // Optional caller photo URL
    participants?: Participant[]; // Optional list of participants for groups
    onAccept: () => void;
    onDecline: () => void;
    subtitle?: string; // Optional custom subtitle
    acceptText?: string; // Optional custom accept button text
    declineText?: string; // Optional custom decline button text
}

export const IncomingCallModal = ({
    visible,
    callerName,
    callerPhoto,
    participants = [],
    onAccept,
    onDecline,
    subtitle = 'Llamada entrante de Tincadia...',
    acceptText = 'Contestar',
    declineText = 'Rechazar'
}: IncomingCallModalProps) => {
    const vibrationInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible) {
            // Phone Call Pattern: Long vibration (2s), pause (1s), repeat
            const PATTERN = [0, 2000, 1000];

            if (Platform.OS === 'android') {
                try {
                    Vibration.vibrate(PATTERN, true);
                } catch (e) {
                    // Fallback to default vibration if pattern fails
                    Vibration.vibrate();
                }
            } else {
                // iOS vibration loop
                const startVibration = () => {
                    Vibration.vibrate(); // Default system vibration (cannot force duration on iOS easily)
                    vibrationInterval.current = setInterval(() => {
                        Vibration.vibrate();
                    }, 2000); // Repeat every 2s
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
                        {callerPhoto ? (
                            <Image
                                source={{ uri: callerPhoto }}
                                style={styles.avatarImage}
                                resizeMode="cover"
                            />
                        ) : (
                            <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
                        )}
                    </View>

                    <Text style={styles.callerName}>{callerName}</Text>
                    <Text style={styles.callStatus}>{subtitle}</Text>

                    {/* Participants List (for groups) */}
                    {participants && participants.length > 0 && (
                        <View style={styles.participantsContainer}>
                            {participants.map((p) => (
                                <View key={p.id} style={styles.participantItem}>
                                    <View style={styles.participantAvatar}>
                                        {p.avatar ? (
                                            <Image
                                                source={{ uri: p.avatar }}
                                                style={styles.participantImage}
                                            />
                                        ) : (
                                            <Text style={styles.participantInitials}>
                                                {p.name.charAt(0).toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={styles.participantName} numberOfLines={1}>
                                        {p.name.split(' ')[0]}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

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
        marginBottom: 20,
        textAlign: 'center',
    },
    participantsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginBottom: 40,
        gap: 15,
        maxWidth: '100%',
    },
    participantItem: {
        alignItems: 'center',
        width: 60,
    },
    participantAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#4B5563',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        overflow: 'hidden',
    },
    participantImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    participantInitials: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    participantName: {
        color: '#D1D5DB',
        fontSize: 12,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    avatarImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
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
