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
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Dimensions,
} from 'react-native';
import { contactService } from '../services/contact.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    const [countryCode, setCountryCode] = useState('CO +57');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update form when initial values change
    useEffect(() => {
        if (visible) {
            setPhone(initialPhone);
            setFirstName(initialFirstName);
            setLastName(initialLastName);
        }
    }, [visible, initialPhone, initialFirstName, initialLastName]);

    const resetForm = () => {
        setPhone('');
        setAlias('');
        setFirstName('');
        setLastName('');
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleAddContact = async () => {
        if (!phone.trim()) {
            setError('El número de teléfono es requerido');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const response = await contactService.addContact({
                ownerId: userId,
                phone: phone.trim(),
                alias: alias.trim() || undefined,
                customFirstName: firstName.trim() || undefined,
                customLastName: lastName.trim() || undefined,
            });

            resetForm();
            onContactAdded(response.contact);
            onClose();
        } catch (err: any) {
            console.error('Error adding contact:', err);
            setError(err?.message || 'No se encontró un usuario con ese número');
        } finally {
            setIsLoading(false);
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
                        <View style={styles.closeButton} />
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
                            <View style={[styles.inputContainer, styles.countryInput]}>
                                <Text style={styles.floatingLabel}>País</Text>
                                <View style={styles.countrySelector}>
                                    <Text style={styles.countryText}>{countryCode}</Text>
                                    <Text style={styles.dropdownArrow}>▼</Text>
                                </View>
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

                        {/* Error Message */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
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

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: SCREEN_HEIGHT * 0.85,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    closeButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
    },
    closeIcon: {
        fontSize: 16,
        color: '#666666',
        fontWeight: '600',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
    },
    form: {
        gap: 16,
    },
    inputContainer: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#FAFAFA',
    },
    floatingLabel: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 4,
    },
    input: {
        fontSize: 16,
        color: '#000000',
        padding: 0,
        margin: 0,
    },
    phoneRow: {
        flexDirection: 'row',
        gap: 12,
    },
    countryInput: {
        flex: 0.35,
    },
    phoneInput: {
        flex: 0.65,
    },
    countrySelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    countryText: {
        fontSize: 16,
        color: '#000000',
    },
    dropdownArrow: {
        fontSize: 10,
        color: '#666666',
        marginLeft: 8,
    },
    errorContainer: {
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        borderRadius: 8,
        padding: 12,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
    },
    saveButton: {
        backgroundColor: '#376A3E',
        borderRadius: 30, // Updated to match other buttons in app (was 28)
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
        ...Platform.select({
            ios: {
                shadowColor: '#376A3E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    saveButtonDisabled: {
        backgroundColor: '#A5D6A7',
        shadowOpacity: 0,
        elevation: 0,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
});
