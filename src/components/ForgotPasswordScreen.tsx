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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { forgotPasswordStyles as styles } from '../styles/ForgotPasswordScreen.styles';

interface ForgotPasswordScreenProps {
    onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
    const [email, setEmail] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    // Android hardware back: always go back to previous screen instead of exiting the app.
    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            onBack();
            return true;
        });

        return () => sub.remove();
    }, [onBack]);

    const handleRecover = () => {
        if (email.trim().length === 0) {
            // Basic validation
            return;
        }
        // TODO: Connect with API to send recovery email
        console.log('Recovering password for:', email);
        setIsSuccess(true);
    };

    if (isSuccess) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar style="dark" />
                <View style={styles.successContainer}>
                    <View style={styles.successIconContainer}>
                        <Text style={styles.successIcon}>✉️</Text>
                    </View>
                    <Text style={styles.successTitle}>¡Correo enviado!</Text>
                    <Text style={styles.successMessage}>
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
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <StatusBar style="dark" />
                <TouchableOpacity style={styles.absoluteBackButton} onPress={onBack}>
                    <Text style={styles.backArrow}>←</Text>
                </TouchableOpacity>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>Recuperar Contraseña</Text>
                    <Text style={styles.subtitle}>
                        Ingresa su correo para restablecer su contraseña
                    </Text>

                    <View style={styles.formContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Correo electrónico"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <TouchableOpacity style={styles.recoverButton} onPress={handleRecover}>
                            <Text style={styles.recoverButtonText}>Confirmar correo</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
