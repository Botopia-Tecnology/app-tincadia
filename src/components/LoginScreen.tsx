import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { GoogleIcon, AppleIcon, MicrosoftIcon } from './icons/SocialIcons';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { loginScreenStyles as styles } from '../styles/LoginScreen.styles';

interface LoginScreenProps {
  onLoginSuccess?: () => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [country, setCountry] = useState('Colombia');

  const handleGoogleLogin = () => {
    // TODO: Implementar login con Google
    console.log('Login con Google');
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleEmailLogin = () => {
    // TODO: Implementar login con email
    console.log('Login con email:', email);
    // Por ahora, navegar directamente a la pantalla de chats
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  const handlePhoneLogin = () => {
    // TODO: Implementar login con teléfono
    console.log('Login con teléfono');
  };

  const handleAppleLogin = () => {
    // TODO: Implementar login con Apple
    console.log('Login con Apple');
  };

  const handleMicrosoftLogin = () => {
    // TODO: Implementar login con Microsoft
    console.log('Login con Microsoft');
  };

  const handleRegister = () => {
    setShowRegister(true);
  };

  if (showRegister) {
    return <RegisterScreen onBack={() => setShowRegister(false)} />;
  }

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
          />

          <TextInput
            style={styles.input}
            placeholder={t('login.password')}
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity onPress={handleForgotPassword}>
            <Text style={styles.forgotPassword}>{t('login.forgotPassword')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loginButton} onPress={handleEmailLogin}>
            <Text style={styles.loginButtonText}>{t('login.loginButton')}</Text>
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
            style={styles.socialButton}
            onPress={handleGoogleLogin}
          >
            <GoogleIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleAppleLogin}
          >
            <AppleIcon size={32} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleMicrosoftLogin}
          >
            <MicrosoftIcon size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.socialButton}
            onPress={() => setShowOtherMethods(true)}
          >
            <Text style={styles.moreIcon}>⋯</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de otros métodos */}
      <Modal
        visible={showOtherMethods}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOtherMethods(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('login.otherMethods')}</Text>
              <TouchableOpacity
                onPress={() => setShowOtherMethods(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButtonModal, styles.phoneButtonModal]}
              onPress={handlePhoneLogin}
            >
              <Text style={styles.phoneIconModal}>📱</Text>
              <Text style={[styles.buttonText, styles.phoneButtonText]}>
                {t('login.continueWithPhone')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
