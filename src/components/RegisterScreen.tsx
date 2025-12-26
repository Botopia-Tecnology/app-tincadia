import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { GoogleIcon, AppleIcon, MicrosoftIcon } from './icons/SocialIcons';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';
import { getDocumentTypeId } from '../types/auth.types';
import Svg, { Circle } from 'react-native-svg';

interface RegisterScreenProps {
  onBack: () => void;
  onRegisterSuccess?: () => void;
}

export function RegisterScreen({ onBack, onRegisterSuccess }: RegisterScreenProps) {
  const { t } = useTranslation();
  const { register, error, clearError, isLoading } = useAuth();
  const { signInWithGoogle, isReady: googleReady } = useGoogleAuth();

  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when step changes
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');

  // Document Type Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const documentTypes = ['T.I', 'C.C', 'C.E', 'PAS'];

  // Validation
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateStep1 = (): boolean => {
    if (!email || !password || !confirmPassword) {
      setValidationError('Por favor completa todos los campos');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError('Por favor ingresa un email válido');
      return false;
    }
    if (password.length < 6) {
      setValidationError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (password !== confirmPassword) {
      setValidationError('Las contraseñas no coinciden');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!firstName || !lastName) {
      setValidationError('Por favor ingresa tu nombre y apellido');
      return false;
    }
    if (!documentType || !documentNumber) {
      setValidationError('Por favor selecciona el tipo e ingresa el número de documento');
      return false;
    }
    if (!phone || phone.length < 7) {
      setValidationError('Por favor ingresa un número de teléfono válido');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2) {
      handleRegister();
    }
  };

  const handleBack = () => {
    setValidationError(null);
    clearError();
    if (step > 1) {
      setStep(step - 1);
    } else {
      onBack();
    }
  };

  // Android hardware back:
  // - Close the document type modal if it's open
  // - Otherwise behave like the UI back button (step back / go back to login)
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      handleBack();
      return true;
    });

    return () => sub.remove();
  }, [modalVisible, step]);

  const handleRegister = async () => {
    if (!validateStep2()) return;

    const documentTypeId = getDocumentTypeId(documentType);
    if (!documentTypeId) {
      setValidationError('Tipo de documento inválido');
      return;
    }

    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        documentTypeId,
        documentNumber,
        phone,
      });
      // Success - AuthContext will handle navigation
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleGoogleRegister = async () => {
    clearError();
    await signInWithGoogle();
  };

  // Progress Circle Component
  const ProgressCircle = ({ current, total }: { current: number; total: number }) => {
    const size = 50;
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = current / total;
    const strokeDashoffset = circumference - progress * circumference;

    return (
      <View style={styles.progressContainer}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            stroke="#E0E0E0"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <Circle
            stroke="#4CAF50"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#000000' }}>
            {current} of {total}
          </Text>
        </View>
      </View>
    );
  };

  const displayError = validationError || error;

  return (
    <KeyboardSafeView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleContainer}>
          <View style={styles.logoArea}>
            <TouchableOpacity style={styles.absoluteBackButton} onPress={handleBack} disabled={isLoading}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            {step === 1 ? (
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={{ height: 80 }} />
            )}
            <View style={styles.absoluteProgress}>
              <ProgressCircle current={step} total={totalSteps} />
            </View>
          </View>
          <Text style={styles.title}>Bienvenido a Tincadia</Text>
          <Text style={styles.subtitle}>
            Crea tu cuenta y comienza a aprender hoy mismo.
          </Text>
        </View>

        {/* Error Message */}
        {displayError && (
          <TouchableOpacity
            onPress={() => { setValidationError(null); clearError(); }}
            style={{
              backgroundColor: '#FFE5E5',
              borderRadius: 8,
              padding: 12,
              marginHorizontal: 20,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#FF4444',
            }}
          >
            <Text style={{ color: '#CC0000', fontSize: 14 }}>{displayError}</Text>
          </TouchableOpacity>
        )}

        {/* Form Content */}
        <View style={styles.formContainer}>
          {step === 1 ? (
            <>
              {/* Step 1: Email & Passwords */}
              <TextInput
                style={styles.input}
                placeholder={t('register.email')}
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <View style={{ width: '100%', position: 'relative' }}>
                <TextInput
                  style={[styles.input, { paddingRight: 50 }]}
                  placeholder={t('register.password')}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 28,
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
              <View style={{ width: '100%', position: 'relative' }}>
                <TextInput
                  style={[styles.input, { paddingRight: 50 }]}
                  placeholder={t('register.confirmPassword')}
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={{
                    position: 'absolute',
                    right: 28,
                    top: 16,
                  }}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye' : 'eye-off'}
                    size={22}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Step 2: Personal Info */}
              <TextInput
                style={styles.input}
                placeholder={t('register.firstName')}
                placeholderTextColor="#999"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!isLoading}
              />
              <TextInput
                style={styles.input}
                placeholder={t('register.lastName')}
                placeholderTextColor="#999"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!isLoading}
              />
              <View style={styles.documentRow}>
                <TouchableOpacity
                  style={styles.documentTypeContainer}
                  onPress={() => setModalVisible(true)}
                  disabled={isLoading}
                >
                  <Text style={[styles.documentTypeText, !documentType && styles.documentTypePlaceholder]}>
                    {documentType || 'Tipo'}
                  </Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.documentNumberInput}
                  placeholder="Número de documento"
                  placeholderTextColor="#999"
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  keyboardType="numeric"
                  editable={!isLoading}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder={t('register.phone')}
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </>
          )}
        </View>

        {/* Social Buttons (Bottom) */}
        <View style={styles.socialSection}>
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>o regístrate con</Text>
            <View style={styles.separatorLine} />
          </View>

          <View style={styles.socialButtons}>
            <TouchableOpacity
              style={[styles.socialButton, (!googleReady || isLoading) && { opacity: 0.5 }]}
              onPress={handleGoogleRegister}
              disabled={!googleReady || isLoading}
            >
              <GoogleIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialButton, isLoading && { opacity: 0.5 }]} disabled={isLoading}>
              <AppleIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.socialButton, isLoading && { opacity: 0.5 }]} disabled={isLoading}>
              <MicrosoftIcon size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, isLoading && { opacity: 0.7 }]}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step === totalSteps ? t('register.createAccount') : 'Continuar'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.termsText}>
            Al continuar estás aceptando nuestros{' '}
            <Text style={styles.linkText}>términos y condiciones</Text> y{' '}
            <Text style={styles.linkText}>tratamiento de mis datos personales</Text>.
          </Text>
        </View>
      </ScrollView>

      {/* Document Type Selection Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona Tipo de Documento</Text>
            <FlatList
              data={documentTypes}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setDocumentType(item);
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardSafeView>
  );
}
