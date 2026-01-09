import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import { GoogleIcon, AppleIcon } from './icons/SocialIcons';
import { FaceIdIcon, FingerprintIcon } from './icons/NavigationIcons';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { loginScreenStyles as styles } from '../styles/LoginScreen.styles';
import { biometricService } from '../services/biometric.service';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useTranslation();
  const { login, loginWithOAuth, error, clearError, isLoading } = useAuth();
  const { signInWithGoogle, isReady: googleReady } = useGoogleAuth();
  const { signInWithApple, isAvailable: isAppleAvailable } = useAppleAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Biometric state
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometría');

  // Check biometrics on mount
  React.useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const { available, biometricType } = await biometricService.isAvailable();
    setIsBiometricAvailable(available);
    if (biometricType) setBiometricType(biometricType);

    if (available) {
      // Check if we have stored credentials to auto-login
      const credentials = await biometricService.getCredentials();
      if (credentials) {
        attemptBiometricLogin(credentials);
      }
    }
  };

  const attemptBiometricLogin = async (credentials?: { email: string; password: string }) => {
    const creds = credentials || await biometricService.getCredentials();
    if (!creds) return; // Nothing stored

    const success = await biometricService.authenticate();
    if (success) {
      // Auto-fill and login
      setEmail(creds.email);
      setPassword(creds.password);
      try {
        await login({ email: creds.email, password: creds.password });
      } catch (e) {
        // Login failed (maybe changed password), let user try manually
        console.log('Biometric auto-login failed:', e);
      }
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    await signInWithGoogle();
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      return;
    }

    clearError();
    try {
      await login({ email, password });

      // If login successful and biometrics available, ask to save
      if (isBiometricAvailable) {
        const stored = await biometricService.getCredentials();
        // Only ask if not already saved or if different
        if (!stored || stored.email !== email) {
          Alert.alert(
            `Habilitar ${biometricType}`,
            `¿Quieres usar ${biometricType} para iniciar sesión más rápido la próxima vez?`,
            [
              { text: 'No', style: 'cancel' },
              {
                text: 'Sí',
                onPress: async () => {
                  await biometricService.saveCredentials({ email, password });
                }
              }
            ]
          );
        } else if (stored.email === email && stored.password !== password) {
          // Update password silently if email matches
          await biometricService.saveCredentials({ email, password });
        }
      }
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleAppleLogin = async () => {
    clearError();
    await signInWithApple();
  };

  const handleRegister = () => {
    clearError(); // Clear any login errors when navigating to register
    setShowRegister(true);
  };

  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <KeyboardSafeView style={styles.container}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo y nombre */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>TINCADIA</Text>
        </View>

        {/* Error message */}
        {error && (
          <TouchableOpacity onPress={clearError} style={{
            backgroundColor: '#FFE5E5',
            borderRadius: 8,
            padding: 12,
            marginHorizontal: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#FF4444',
          }}>
            <Text style={{ color: '#CC0000', fontSize: 14 }}>{error}</Text>
          </TouchableOpacity>
        )}

        {/* Formulario de login */}
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder={t('login.email')}
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <View style={{ width: '90%', alignSelf: 'center', position: 'relative' }}>
            <TextInput
              style={[styles.input, { width: '100%', marginBottom: 16, paddingRight: 50 }]}
              placeholder={t('login.password')}
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={{
                position: 'absolute',
                right: 16,
                top: 16,
              }}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons
                name={showPassword ? 'eye' : 'eye-off'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
            <Text style={styles.forgotPassword}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && { opacity: 0.7 }]}
            onPress={handleEmailLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>{t('login.loginButton')}</Text>
            )}
          </TouchableOpacity>

          {/* Biometric Button (Manual Trigger) */}
          {isBiometricAvailable && (
            <TouchableOpacity
              onPress={() => attemptBiometricLogin()}
              style={{
                alignSelf: 'center',
                marginTop: 10,
                marginBottom: 10,
                padding: 12,
                alignItems: 'center',
                backgroundColor: Platform.OS === 'ios' ? '#F0F8FF' : '#E8F5E9',
                borderRadius: 16,
                minWidth: 100,
              }}
            >
              {Platform.OS === 'ios' ? (
                <FaceIdIcon size={48} color="#007AFF" />
              ) : (
                <FingerprintIcon size={48} color="#25D366" />
              )}
              <Text style={{
                textAlign: 'center',
                fontSize: 13,
                fontWeight: '500',
                color: Platform.OS === 'ios' ? '#007AFF' : '#25D366',
                marginTop: 8,
              }}>
                {Platform.OS === 'ios' ? 'Face ID' : 'Huella dactilar'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>
              {t('login.noAccount')} •{' '}
              <Text style={styles.registerLinkText} onPress={handleRegister}>
                {t('login.register')}
              </Text>
            </Text>
          </View>
        </View>

        {/* Separador */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
        </View>

        {/* Botones sociales */}
        <View style={styles.socialContainer}>
          <TouchableOpacity
            style={[styles.socialButton, (!googleReady || isLoading) && { opacity: 0.5 }]}
            onPress={handleGoogleLogin}
            disabled={!googleReady || isLoading}
          >
            <GoogleIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, (!isAppleAvailable || isLoading) && { opacity: 0.5 }]}
            onPress={handleAppleLogin}
            disabled={!isAppleAvailable || isLoading}
          >
            <AppleIcon size={32} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>


    </KeyboardSafeView>
  );
}
