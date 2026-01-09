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
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { contactService } from '../services/contact.service';
import { addContactModalStyles as styles } from '../styles/AddContactModal.styles';
import { showAlert } from './common/CustomAlert';

import { CountryCodePicker, defaultCountry } from './common/CountryCodePicker';
import { SyncIcon } from './icons/NavigationIcons';

interface AddContactModalProps {
    visible: boolean;
    onClose: () => void;
    onContactAdded: (contact?: any) => void;
    userId: string;
    initialPhone?: string;
    initialFirstName?: string;
    initialLastName?: string;
}

export function AddContactModal({
    visible,
    onClose,
    onContactAdded,
    userId,
    initialPhone = '',
    initialFirstName = '',
    initialLastName = '',
}: AddContactModalProps) {
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
        const fullPhone = `${selectedCountry.dialCode}${cleanInput}`; // e.g. +573001234567

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
            onClose();
        } catch (err: any) {
            console.error('Error adding contact:', err);
            const msg = err?.message || 'No se encontró un usuario con ese número';

            showAlert({
                type: 'error',
                title: 'Error',
                message: msg,
                buttons: [{ text: 'Entendido', style: 'default' }]
            });
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
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : -50}
            >
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={handleClose}
                />

                <View style={styles.container}>
                    {/* Handle bar */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Nuevo contacto</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => {
                                // Sync logic placeholder (or just visual as requested)
                                console.log('Sync clicked');
                            }}
                        >
                            <SyncIcon size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        {/* Nombre */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.floatingLabel}>Nombre</Text>
                            <TextInput
                                style={styles.input}
                                value={firstName}
                                onChangeText={setFirstName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* Apellido */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.floatingLabel}>Apellido</Text>
                            <TextInput
                                style={styles.input}
                                value={lastName}
                                onChangeText={setLastName}
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* Alias */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.floatingLabel}>Alias</Text>
                            <TextInput
                                style={styles.input}
                                value={alias}
                                onChangeText={setAlias}
                                placeholder="Ej: Trabajo, Familia..."
                                placeholderTextColor="#999"
                            />
                        </View>

                        {/* País + Teléfono */}
                        <View style={styles.phoneRow}>
                            <View style={{ marginRight: 8, marginTop: 24 }}>
                                <CountryCodePicker
                                    selectedCountry={selectedCountry}
                                    onSelect={setSelectedCountry}
                                />
                            </View>

                            <View style={[styles.inputContainer, styles.phoneInput]}>
                                <Text style={styles.floatingLabel}>Teléfono</Text>
                                <TextInput
                                    style={styles.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    placeholderTextColor="#999"
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
