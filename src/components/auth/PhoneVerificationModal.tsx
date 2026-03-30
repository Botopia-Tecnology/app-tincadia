import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { authService } from '../../services/auth.service';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface PhoneVerificationModalProps {
    visible: boolean;
    onClose: () => void;
    onVerified: (phoneNumber: string) => void;
    initialPhoneNumber?: string;
}

export function PhoneVerificationModal({ visible, onClose, onVerified, initialPhoneNumber = '' }: PhoneVerificationModalProps) {
    const [step, setStep] = useState<'phone' | 'code'>('phone');
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
    const [code, setCode] = useState('');
    const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            setStep('phone');
            setPhoneNumber(initialPhoneNumber);
            setCode('');
            setConfirm(null);
            setLoading(false);
        }
    }, [visible, initialPhoneNumber]);

    const handleSendCode = async () => {
        if (!phoneNumber || phoneNumber.length < 10) {
            Alert.alert('Error', 'Ingresa un número de celular válido (+57...)');
            return;
        }

        setLoading(true);
        try {
            // Ensure format e.g. +573001234567
            // If user didn't type +, assume local or force usage
            // Ideally use a library like google-libphonenumber but simple check for now
            let formattedPhone = phoneNumber;
            if (!formattedPhone.startsWith('+')) {
                // Default to Colombia or ask user? assuming user types full code for now or default +57
                formattedPhone = `+57${phoneNumber.replace(/^0+/, '')}`; // Simple default
            }

            const confirmation = await authService.signInWithPhoneNumber(formattedPhone);
            setConfirm(confirmation);
            setStep('code');
        } catch (error: unknown) {
            console.error('Error sending code', error);
            const err = error as { code?: string };
            let msg = 'No se pudo enviar el código. Intenta de nuevo.';
            if (err.code === 'auth/invalid-phone-number') msg = 'El número de teléfono no es válido.';
            if (err.code === 'auth/quota-exceeded') msg = 'Límite de SMS excedido por hoy.';
            if (err.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera un momento.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!code || code.length < 6) return;

        setLoading(true);
        try {
            await authService.confirmCode(confirm, code);
            Alert.alert('Éxito', 'Número verificado correctamente.');
            onVerified(phoneNumber); // Return original input or formatted?
            onClose();
        } catch (error) {
            console.error('Invalid code', error);
            Alert.alert('Error', 'El código es incorrecto.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
            >
                <View style={styles.modalContent}>
                    <Text style={styles.title}>Validar Celular</Text>

                    {step === 'phone' ? (
                        <>
                            <Text style={styles.subtitle}>
                                Te enviaremos un código SMS para verificar tu número.
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={phoneNumber}
                                onChangeText={setPhoneNumber}
                                placeholder="300 123 4567"
                                keyboardType="phone-pad"
                                autoFocus
                            />
                            <Text style={styles.helperText}>
                                Formato: +57 300... o simplemente 300...
                            </Text>

                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
                                    <Text style={styles.cancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmButton, loading && styles.disabledButton]}
                                    onPress={handleSendCode}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Enviar Código</Text>}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={styles.subtitle}>
                                Ingresa el código de 6 dígitos enviado a {phoneNumber}.
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={setCode}
                                placeholder="123456"
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />

                            <View style={styles.buttonRow}>
                                <TouchableOpacity style={styles.cancelButton} onPress={() => setStep('phone')} disabled={loading}>
                                    <Text style={styles.cancelText}>Volver</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmButton, loading && styles.disabledButton]}
                                    onPress={handleVerifyCode}
                                    disabled={loading}
                                >
                                    {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmText}>Verificar</Text>}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1a1a1a',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        marginBottom: 8,
    },
    helperText: {
        fontSize: 12,
        color: '#999',
        marginBottom: 20,
        marginLeft: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f5f5f5',
        alignItems: 'center',
    },
    confirmButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#4CAF50',
        alignItems: 'center',
    },
    cancelText: {
        color: '#666',
        fontWeight: '600',
    },
    confirmText: {
        color: '#FFF',
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.7,
    },
});
