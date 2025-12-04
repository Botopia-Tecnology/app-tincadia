import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '../hooks/useTranslation';
import { GoogleIcon, AppleIcon, MicrosoftIcon } from './icons/SocialIcons';
import { registerScreenStyles as styles } from '../styles/RegisterScreen.styles';
import Svg, { Circle } from 'react-native-svg';

export function RegisterScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const scrollViewRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when step changes
  useEffect(() => {
    // Small delay to ensure layout is complete
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [step]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [phone, setPhone] = useState('');

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onBack();
    }
  };

  const handleRegister = () => {
    // TODO: Implementar lógica de registro
    console.log('Register:', {
      email,
      password,
      firstName,
      lastName,
      documentType,
      documentNumber,
      phone
    });
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar style="dark" />
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header with Back Button and Progress */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <ProgressCircle current={step} total={totalSteps} />
          </View>

          {/* Title Section */}
          <View style={styles.titleContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Bienvenido a Tincadia</Text>
            <Text style={styles.subtitle}>
              Crea tu cuenta y comienza a aprender hoy mismo.
            </Text>
          </View>

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
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.password')}
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.confirmPassword')}
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
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
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.lastName')}
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Tipo de documento"
                  placeholderTextColor="#999"
                  value={documentType}
                  onChangeText={setDocumentType}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Número de documento"
                  placeholderTextColor="#999"
                  value={documentNumber}
                  onChangeText={setDocumentNumber}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('register.phone')}
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
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
              <TouchableOpacity style={styles.socialButton}>
                <GoogleIcon size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <AppleIcon size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <MicrosoftIcon size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Text style={styles.nextButtonText}>
                {step === totalSteps ? t('register.createAccount') : 'Continuar'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              Al continuar estás aceptando nuestros{' '}
              <Text style={styles.linkText}>términos y condiciones</Text> y{' '}
              <Text style={styles.linkText}>tratamiento de mis datos personales</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
