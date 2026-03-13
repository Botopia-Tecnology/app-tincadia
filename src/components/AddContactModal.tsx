/**
 * Add Contact Modal
 * 
 * Bottom sheet modal for adding a new contact.
 * Dark theme with outlined inputs.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { contactService } from '../services/contact.service';
import { addContactModalStyles as styles } from '../styles/AddContactModal.styles';
import { showAlert } from './common/CustomAlert';

import { CountryCodePicker, defaultCountry } from './common/CountryCodePicker';
import { SyncIcon } from './icons/NavigationIcons';
import { useTheme } from '../contexts/ThemeContext';

interface AddContactModalProps {
    visible: boolean;
    onClose: () => void;
    onContactAdded: (contact?: any) => void;
    userId: string;
    initialPhone?: string;
    initialFirstName?: string;
    initialLastName?: string;
    initialContactUserId?: string; // New prop to handle sync fixes
    onSyncRequested?: () => void;
}

export function AddContactModal({
    visible,
    onClose,
    onContactAdded,
    userId,
    initialPhone = '',
    initialFirstName = '',
    initialLastName = '',
    initialContactUserId,
    onSyncRequested,
}: AddContactModalProps) {
    const { colors, isDark } = useTheme();
    const [phone, setPhone] = useState(initialPhone);
    const [alias, setAlias] = useState('');
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [selectedCountry, setSelectedCountry] = useState(defaultCountry);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            let cleanPhone = initialPhone.trim();
            const dialCode = selectedCountry.dialCode;

            // Remove dial code if present (handling + or no +)
            if (cleanPhone.startsWith(dialCode)) {
                cleanPhone = cleanPhone.substring(dialCode.length).trim();
            } else if (cleanPhone.startsWith(dialCode.replace('+', ''))) {
                cleanPhone = cleanPhone.substring(dialCode.length - 1).trim();
            }

            // Also remove internal spaces if any
            cleanPhone = cleanPhone.replace(/\s/g, '');

            setPhone(cleanPhone);
            setFirstName(initialFirstName);
            setLastName(initialLastName);
        }
    }, [visible, initialPhone, initialFirstName, initialLastName]);

    const resetForm = () => {
        setPhone('');
        setAlias('');
        setFirstName('');
        setLastName('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleAddContact = async () => {
        if (!phone.trim()) {
            showAlert({
                type: 'error',
                title: 'Error',
                message: 'El número de teléfono es requerido',
            });
            return;
        }

        setIsLoading(true);

        // Format phone with dial code: Strip non-numeric characters from input
        const cleanInput = phone.replace(/\D/g, '');
        let fullPhone = '';

        // Check if user already typed the dial code (e.g. 57300...)
        const dialCodeDigits = selectedCountry.dialCode.replace(/\D/g, '');

        if (cleanInput.startsWith(dialCodeDigits)) {
            // User typed 57300..., just prepend + if needed
            fullPhone = `+${cleanInput}`;
        } else {
            // Prepend the selected dial code
            fullPhone = `${selectedCountry.dialCode}${cleanInput}`;
        }

        // 1. Check LOCAL contacts first to avoid unnecessary API calls
        // We need to check if we already have this number
        try {
            // We can't import getLocalContacts directly inside component easily if it's not exposed via hook/context
            // But we can assume if the user is in the list, we shouldn't add them.
            // Since we don't have direct access to the full contact list here (unless passed in props),
            // We'll proceed to API but handle the specific 400/409 error gracefully.

            // Actually, we CAN check if we pass the current list or use a service helper. 
            // For now, let's rely on better error handling from backend response.
        } catch (e) { }

        try {
            const response = await contactService.addContact({
                ownerId: userId,
                phone: fullPhone,
                alias: alias.trim() || undefined,
                customFirstName: firstName.trim() || undefined,
                customLastName: lastName.trim() || undefined,
            });

            resetForm();
            onContactAdded(response.contact);

            // Force save to local DB immediately so ChatView finds it
            try {
                const { saveContact } = require('../database/chatDatabase'); // Import inline to avoid cycle if any, or just top level
                const c = response.contact;
                saveContact({
                    id: c.id,
                    ownerId: c.ownerId,
                    contactUserId: c.contactUserId,
                    phone: c.phone,
                    alias: c.alias,
                    customFirstName: c.customFirstName,
                    customLastName: c.customLastName
                });
                console.log('💾 Contact saved locally immediately:', c.id);
            } catch (err) {
                console.error('Failed to save contact locally:', err);
            }

            onClose();

            // Show success message
            showAlert({
                type: 'success',
                title: 'Contacto guardado',
                message: 'Se ha añadido a tus contactos correctamente.',
            });

        } catch (err: any) {
            console.error('Error adding contact:', err);

            // Check for "already exists" error
            // The backend likely returns 400 or 409 with a message
            const errorMsg = err?.message || '';

            if (errorMsg.includes('already exists') || errorMsg.includes('ya existe') || errorMsg.includes('duplicate')) {
                // IT ALREADY EXISTS! Treat as success for the UI (remove "Add" button)
                console.log('✅ Contact already exists, treating as success for UI sync.');

                // If we have the ID from props, pass it back so parent removes it from list
                if (initialContactUserId) {
                    onContactAdded({ contactUserId: initialContactUserId });
                } else {
                    // Fallback: trigger parent refresh blindly
                    onContactAdded(undefined);
                }

                // Force full sync to get the missing contact data
                if (onSyncRequested) onSyncRequested();

                showAlert({
                    type: 'success',
                    title: 'Contacto sincronizado',
                    message: 'Este usuario ya estaba en tu lista. Se han actualizado sus datos.',
                    buttons: [{ text: 'OK', style: 'default' }]
                });

                resetForm();
                onClose();
            } else {
                const msg = err?.message || 'No se encontró un usuario con ese número';
                showAlert({
                    type: 'error',
                    title: 'Error',
                    message: msg,
                    buttons: [{ text: 'Entendido', style: 'default' }]
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickContact = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') {
                showAlert({
                    type: 'error',
                    title: 'Permiso denegado',
                    message: 'Se necesita permiso para acceder a los contactos.',
                });
                return;
            }

            const { data } = await Contacts.getContactsAsync({
                fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
            });

            if (data.length > 0) {
                // Placeholder for future implementation
            }
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={handleClose}
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -50}
            >
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={handleClose}
                />

                <View style={[styles.container, { backgroundColor: colors.surface }]}>
                    {/* Handle bar */}
                    <View style={styles.handleContainer}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={[styles.closeButton, { backgroundColor: colors.background }]}>
                            <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.text }]}>Nuevo contacto</Text>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: isDark ? colors.background : '#F5F5F5',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 20
                            }}
                            onPress={() => {
                                // Close modal and trigger sync (we need to pass this up or expose it)
                                // Since we can't easily trigger the hook in parent from here without prop event,
                                // we'll use a new prop 'onSyncRequested' or assuming the user wants to go to logic.
                                // But wait, AddContactModal is instantiated in ChatsScreen.
                                // We should add onSyncRequested prop.
                                if (onSyncRequested) {
                                    onSyncRequested();
                                } else {
                                    Alert.alert('Info', 'Usa el botón de sincronizar en la pantalla principal');
                                }
                            }}
                        >
                            <SyncIcon size={16} color={colors.textSecondary} />
                            <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                                Sincronizar
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Nombre */}
                        <View style={[styles.inputContainer, { backgroundColor: isDark ? colors.inputBg : '#FAFAFA', borderColor: colors.border }]}>
                            <Text style={[styles.floatingLabel, { color: colors.textSecondary }]}>Nombre</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Apellido */}
                        <View style={[styles.inputContainer, { backgroundColor: isDark ? colors.inputBg : '#FAFAFA', borderColor: colors.border }]}>
                            <Text style={[styles.floatingLabel, { color: colors.textSecondary }]}>Apellido</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* Alias */}
                        <View style={[styles.inputContainer, { backgroundColor: isDark ? colors.inputBg : '#FAFAFA', borderColor: colors.border }]}>
                            <Text style={[styles.floatingLabel, { color: colors.textSecondary }]}>Alias</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text }]}
                                value={alias}
                                onChangeText={setAlias}
                                placeholder="Ej: Trabajo, Familia..."
                                placeholderTextColor={colors.textMuted}
                            />
                        </View>

                        {/* País + Teléfono */}
                        <View style={styles.phoneRow}>
                            <View style={{ marginRight: 8, marginTop: 24 }}>
                                <CountryCodePicker
                                    selectedCountry={selectedCountry}
                                    onSelect={setSelectedCountry}
                                    theme={isDark ? 'dark' : 'light'}
                                />
                            </View>

                            <View style={[styles.inputContainer, styles.phoneInput, { backgroundColor: isDark ? colors.inputBg : '#FAFAFA', borderColor: colors.border }]}>
                                <Text style={[styles.floatingLabel, { color: colors.textSecondary }]}>Teléfono</Text>
                                <TextInput
                                    style={[styles.input, { color: colors.text }]}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    placeholderTextColor={colors.textMuted}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
                        onPress={handleAddContact}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.saveButtonText}>Guardar</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
