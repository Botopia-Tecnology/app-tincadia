import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    SafeAreaView,
    BackHandler,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { forgotPasswordStyles as styles } from '../styles/ForgotPasswordScreen.styles';
import { authService } from '../services/auth.service';
import { useTheme } from '../contexts/ThemeContext';

interface ForgotPasswordScreenProps {
    onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
    const { colors, isDark } = useTheme();
    const [email, setEmail] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Android hardware back: always go back to previous screen instead of exiting the app.
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => sub.remove();
    }, [onBack]);

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleRecover = async () => {
        setError(null);

        const trimmedEmail = email.trim();
        if (trimmedEmail.length === 0) {
            setError('Por favor ingresa tu correo electrónico');
            return;
        }

        if (!validateEmail(trimmedEmail)) {
            setError('Por favor ingresa un correo electrónico válido');
            return;
        }

        setIsLoading(true);

        try {
            await authService.requestPasswordReset(trimmedEmail);
            setIsSuccess(true);
        } catch (err: any) {
            console.error('Error al solicitar recuperación de contraseña:', err);

            // Handle specific error messages
            const errorMessage = err?.message || err?.error || 'Error desconocido';

            if (errorMessage.includes('not found') || errorMessage.includes('no encontrado')) {
                setError('No existe una cuenta con este correo electrónico');
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                setError('Error de conexión. Por favor verifica tu internet');
            } else {
                setError('Ocurrió un error al enviar el correo de recuperación. Intenta de nuevo.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <View style={[styles.successContainer, { backgroundColor: colors.background }]}>
                    <View style={styles.successIconContainer}>
                        <Text style={styles.successIcon}>✉️</Text>
                    </View>
                    <Text style={[styles.successTitle, { color: colors.text }]}>¡Correo enviado!</Text>
                    <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
                        Hemos enviado un enlace de recuperación a tu correo electrónico. Por favor revisa tu bandeja de entrada.
                    </Text>
                    <TouchableOpacity style={styles.backToLoginButton} onPress={onBack}>
                        <Text style={styles.backToLoginText}>Volver al inicio de sesión</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <StatusBar style={isDark ? 'light' : 'dark'} />
                <TouchableOpacity style={styles.absoluteBackButton} onPress={onBack} disabled={isLoading}>
                    <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
                </TouchableOpacity>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={[styles.title, { color: colors.text }]}>Recuperar Contraseña</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Ingresa su correo para restablecer su contraseña
                    </Text>

                    <View style={styles.formContainer}>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: error ? '#ff4444' : colors.border }]}
                            placeholder="Correo electrónico"
                            placeholderTextColor={colors.textMuted}
                            value={email}
                            onChangeText={(text) => {
                                setEmail(text);
                                setError(null);
                            }}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isLoading}
                        />

                        {error && (
                            <Text style={{ color: '#ff4444', marginBottom: 10, fontSize: 14 }}>
                                {error}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[styles.recoverButton, isLoading && { opacity: 0.7 }]}
                            onPress={handleRecover}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.recoverButtonText}>Confirmar correo</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
