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
import { KeyboardSafeView } from '../components/common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useAppleAuth } from '../hooks/useAppleAuth';
import { GoogleIcon, AppleIcon } from '../components/icons/SocialIcons';
import { FaceIdIcon, FingerprintIcon } from '../components/icons/NavigationIcons';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { loginScreenStyles as styles } from '../styles/LoginScreen.styles';
import { biometricService } from '../services/biometric.service';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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
  const [hasStoredCredentials, setHasStoredCredentials] = useState(false);
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
      // Check if we have stored credentials
      const credentials = await biometricService.getCredentials();
      const hasCreds = !!credentials;
      setHasStoredCredentials(hasCreds);

      // Only auto-attempt if it was a password-based account
      // For Google/Apple, it's better to let the user tap the icon
      if (hasCreds && credentials?.provider === 'email') {
        attemptBiometricLogin(credentials);
      }
    }
  };

  const attemptBiometricLogin = async (credentials?: import("../services/biometric.service").BiometricCredentials) => {
    const creds = credentials || await biometricService.getCredentials();
    if (!creds) return; 

    // Trigger OS biometric prompt
    const success = await biometricService.authenticate();
    if (!success) return;

    try {
      if (creds.provider === 'email' && creds.password) {
        // Auto-fill and login for email/password
        setEmail(creds.email);
        setPassword(creds.password);
        await login({ email: creds.email, password: creds.password });
      } else if (creds.provider === 'google') {
        // Trigger Google Login automatically
        await signInWithGoogle();
      } else if (creds.provider === 'apple') {
        // Trigger Apple Login automatically
        await signInWithApple();
      }
    } catch (e) {
      console.log('Biometric auto-login failed:', e);
    }
  };

  const handleGoogleLogin = async () => {
    clearError();
    try {
      const user = await signInWithGoogle();
      if (user?.email) {
        handleLoginSuccess(user.email, undefined, 'google');
      }
    } catch (e) {
      console.error('Google login error:', e);
    }
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
      const user = await login({ email, password });
      if (user?.email) {
        handleLoginSuccess(user.email, password, 'email');
      }
    } catch {
      // Error is handled by AuthContext
    }
  };

  /**
   * Centralized logic to offer biometric enrollment after any successful login
   */
  const handleLoginSuccess = async (userEmail: string, userPassword?: string, provider: 'email' | 'google' | 'apple' = 'email') => {
    if (!isBiometricAvailable) return;

    const stored = await biometricService.getCredentials();
    
    // Only ask if not already saved for this specific email/account
    if (!stored || stored.email !== userEmail || stored.provider !== provider) {
      Alert.alert(
        `Habilitar ${biometricType}`,
        `¿Quieres usar ${biometricType} para iniciar sesión más rápido la próxima vez?`,
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Sí, activar',
            onPress: async () => {
              try {
                // Ensure the user authenticates once to "authorize" the storage
                const ok = await biometricService.authenticate();
                if (ok) {
                    await biometricService.saveCredentials({ 
                        email: userEmail, 
                        password: userPassword, 
                        provider 
                    });
                    setHasStoredCredentials(true);
                }
              } catch (e) {
                console.error('Failed to enroll biometrics:', e);
              }
            }
          }
        ]
      );
    } else if (provider === 'email' && userPassword && stored.password !== userPassword) {
      // Update password silently if using email login and password changed
      await biometricService.saveCredentials({ email: userEmail, password: userPassword, provider });
    }
  };

  const { user } = useAuth();

  const handleAppleLogin = async () => {
    clearError();
    try {
      const user = await signInWithApple();
      if (user?.email) {
        handleLoginSuccess(user.email, undefined, 'apple');
      }
    } catch (e) {
      console.error('Apple login error:', e);
    }
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
    <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo y nombre */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/icon.png')}
            style={[styles.logo, { tintColor: isDark ? '#FFFFFF' : undefined }]}
            resizeMode="contain"
          />
          <Text style={[styles.appName, { color: colors.text }]}>TINCADIA</Text>
        </View>

        {/* Error message */}
        {error && (
          <TouchableOpacity onPress={clearError} style={{
            backgroundColor: isDark ? 'rgba(255, 68, 68, 0.1)' : '#FFE5E5',
            borderRadius: 8,
            padding: 12,
            marginHorizontal: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#FF4444',
          }}>
            <Text style={{ color: '#FF4444', fontSize: 14 }}>{error}</Text>
          </TouchableOpacity>
        )}

        {/* Formulario de login */}
        <View style={styles.formContainer}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder={t('login.email')}
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <View style={{ width: '90%', alignSelf: 'center', position: 'relative' }}>
            <TextInput
              style={[styles.input, { width: '100%', marginBottom: 16, paddingRight: 50, backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder={t('login.password')}
              placeholderTextColor={colors.textMuted}
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
                color={colors.iconSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading}>
            <Text style={[styles.forgotPassword, { color: colors.textSecondary }]}>{t('login.forgotPassword')}</Text>
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
          {isBiometricAvailable && hasStoredCredentials && (
            <TouchableOpacity
              onPress={() => attemptBiometricLogin()}
              style={{
                alignSelf: 'center',
                marginTop: 10,
                marginBottom: 10,
                padding: 12,
                alignItems: 'center',
                backgroundColor: isDark ? colors.card : (Platform.OS === 'ios' ? '#F0F8FF' : '#E8F5E9'),
                borderRadius: 16,
                minWidth: 100,
              }}
            >
              {Platform.OS === 'ios' ? (
                <FaceIdIcon size={48} color={isDark ? '#4A90E2' : "#007AFF"} />
              ) : (
                <FingerprintIcon size={48} color={isDark ? '#4CAF50' : "#25D366"} />
              )}
              <Text style={{
                textAlign: 'center',
                fontSize: 13,
                fontWeight: '500',
                color: isDark ? colors.text : (Platform.OS === 'ios' ? '#007AFF' : '#25D366'),
                marginTop: 8,
              }}>
                {Platform.OS === 'ios' ? 'Face ID' : 'Huella dactilar'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.registerContainer}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>
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
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <GoogleIcon size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, (!isAppleAvailable || isLoading) && { opacity: 0.5 }]}
            onPress={handleAppleLogin}
            disabled={!isAppleAvailable || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <AppleIcon size={32} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>


    </KeyboardSafeView>
  );
}
