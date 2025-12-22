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
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { DOCUMENT_TYPE_MAP } from '../types/auth.types';
import { completeProfileStyles as styles } from '../styles/CompleteProfileScreen.styles';

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_MAP);

export function CompleteProfileScreen() {
    const { user, updateProfile, error, clearError, isLoading } = useAuth();

    const [documentType, setDocumentType] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [phone, setPhone] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

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
                phone,
            });
        } catch {
            // Error is handled by context
        }
    };

    const isFormValid = documentType && documentNumber.length >= 5 && phone.length >= 7;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
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
                        <TextInput
                            style={styles.input}
                            placeholder="Ingresa tu número de teléfono"
                            placeholderTextColor="#999"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                        />
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
            </KeyboardAvoidingView>

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
        </SafeAreaView>
    );
}
