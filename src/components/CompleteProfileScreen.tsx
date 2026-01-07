/**
 * Complete Profile Screen
 * 
 * Shown after OAuth login when user's profile is incomplete.
 * Collects required profile info: document type, document number, phone.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    FlatList,
    ActivityIndicator,
    Platform,
    ScrollView,
} from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context'; // Managed by KeyboardSafeView
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { useAuth } from '../contexts/AuthContext';
import { DOCUMENT_TYPE_MAP } from '../types/auth.types';
import { completeProfileStyles as styles } from '../styles/CompleteProfileScreen.styles';
import { CountryCodePicker, defaultCountry } from './common/CountryCodePicker';

// Phone OTP verification temporarily disabled
// import { PhoneVerificationModal } from './auth/PhoneVerificationModal';

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_MAP);

export function CompleteProfileScreen() {
    const { user, updateProfile, error, clearError, isLoading } = useAuth();

    const [documentType, setDocumentType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
    const [modalVisible, setModalVisible] = useState(false);

    // Verification State (OTP temporarily disabled)
    // const [phoneVerificationVisible, setPhoneVerificationVisible] = useState(false);
    const [isPhoneVerified, setIsPhoneVerified] = useState(true); // Auto-verified for now

    // Initialize form with existing user data
    React.useEffect(() => {
        if (user) {
            if (user.documentType) {
                // Reverse lookup or direct set if we had the key
                // For now, if documentType is 'C.C', set it.
                // If it's the ID, we might need to find the key.
                const typeEntry = Object.entries(DOCUMENT_TYPE_MAP).find(([key, val]) => val === user.documentTypeId || key === user.documentType);
                if (typeEntry) setDocumentType(typeEntry[0]);
            }
            if (user.documentNumber) setDocumentNumber(user.documentNumber);

            if (user.phone) {
                // Simple parsing: assume default country (+57) for now or try to extract
                // If starts with +57, strip it. 
                // ideally use a phone library but for this scope:
                const dialCode = defaultCountry.dialCode; // +57
                if (user.phone.startsWith(dialCode)) {
                    setPhone(user.phone.slice(dialCode.length));
                } else {
                    setPhone(user.phone);
                }
                setIsPhoneVerified(true);
            }
        }
    }, [user]);

    const handleSubmit = async () => {
        if (!documentType || !documentNumber || !phone) {
            return;
        }

        const documentTypeId = DOCUMENT_TYPE_MAP[documentType];
        if (!documentTypeId) {
            return;
        }

        try {
            await updateProfile({
                documentTypeId,
                documentNumber,
                phone: `${selectedCountry.dialCode}${phone}`,
            });
        } catch {
            // Error is handled by context
        }
    };



    const isFormValid = documentType && documentNumber.length >= 5 && phone.length >= 7;



    return (
        <KeyboardSafeView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Completa tu Perfil</Text>
                    <Text style={styles.subtitle}>
                        ¡Hola {user?.firstName || 'Usuario'}! Necesitamos algunos datos adicionales para continuar.
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <TouchableOpacity style={styles.errorContainer} onPress={clearError}>
                        <Text style={styles.errorText}>{error}</Text>
                        <Text style={styles.errorDismiss}>Tocar para cerrar</Text>
                    </TouchableOpacity>
                )}

                {/* Form */}
                <View style={styles.form}>
                    {/* Document Type */}
                    <Text style={styles.label}>Tipo de Documento</Text>
                    <TouchableOpacity
                        style={styles.select}
                        onPress={() => setModalVisible(true)}
                    >
                        <Text style={documentType ? styles.selectText : styles.selectPlaceholder}>
                            {documentType || 'Seleccionar...'}
                        </Text>
                        <Text style={styles.selectArrow}>▼</Text>
                    </TouchableOpacity>

                    {/* Document Number */}
                    <Text style={styles.label}>Número de Documento</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ingresa tu número de documento"
                        placeholderTextColor="#999"
                        value={documentNumber}
                        onChangeText={setDocumentNumber}
                        keyboardType="numeric"
                    />

                    {/* Phone */}
                    <Text style={styles.label}>Teléfono</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <CountryCodePicker
                            selectedCountry={selectedCountry}
                            onSelect={setSelectedCountry}
                        />
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                            placeholder="Número de teléfono"
                            placeholderTextColor="#999"
                            value={phone}
                            onChangeText={(text) => {
                                setPhone(text);
                                setIsPhoneVerified(false); // Reset verification on edit
                            }}
                            keyboardType="phone-pad"
                        />
                        {/* Phone verification temporarily disabled */}
                        {phone.length > 7 && (
                            <View style={{ justifyContent: 'center', alignItems: 'center', padding: 10 }}>
                                <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>✓</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, !isFormValid && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={!isFormValid || isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Completar Registro</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Phone verification modal temporarily disabled */}

            {/* Document Type Modal */}
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
                            data={DOCUMENT_TYPES}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                        setDocumentType(item);
                                        setModalVisible(false);
                                    }}
                                >
                                    <Text style={styles.modalItemText}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </KeyboardSafeView>
    );
}
