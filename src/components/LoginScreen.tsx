import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,

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
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { loginScreenStyles as styles } from '../styles/LoginScreen.styles';

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
      // onLoginSuccess is no longer needed - AuthContext handles navigation
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleAppleLogin = async () => {
    clearError();
    await signInWithApple();
  };

  const handleMicrosoftLogin = async () => {
    clearError();
    await signInWithMicrosoft();
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
