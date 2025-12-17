/**
 * Add Contact Modal
 * 
 * Modal for adding a new contact by phone number.
 * Allows setting custom name and alias.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { contactService } from '../services/contact.service';

interface AddContactModalProps {
    visible: boolean;
    onClose: () => void;
    onContactAdded: () => void;
    userId: string;
}

export function AddContactModal({ visible, onClose, onContactAdded, userId }: AddContactModalProps) {
    const [phone, setPhone] = useState('');
    const [alias, setAlias] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            await contactService.addContact({
                ownerId: userId,
                phone: phone.trim(),
                alias: alias.trim() || undefined,
                customFirstName: firstName.trim() || undefined,
                customLastName: lastName.trim() || undefined,
            });

            resetForm();
            onContactAdded();
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
                <View style={styles.container}>
                    <Text style={styles.title}>Agregar Contacto</Text>

                    {/* Phone Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Número de teléfono *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 3001234567"
                            placeholderTextColor="#9CA3AF"
                            value={phone}
                            onChangeText={setPhone}
                            keyboardType="phone-pad"
                            autoFocus
                        />
                    </View>

                    {/* Alias Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Alias (cómo quieres guardarlo)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Mi jefe, Mamá, etc."
                            placeholderTextColor="#9CA3AF"
                            value={alias}
                            onChangeText={setAlias}
                        />
                    </View>

                    {/* First Name Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nombre</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre del contacto"
                            placeholderTextColor="#9CA3AF"
                            value={firstName}
                            onChangeText={setFirstName}
                        />
                    </View>

                    {/* Last Name Input */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Apellido</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Apellido del contacto"
                            placeholderTextColor="#9CA3AF"
                            value={lastName}
                            onChangeText={setLastName}
                        />
                    </View>

                    {/* Error Message */}
                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Buttons */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={handleClose}
                            disabled={isLoading}
                        >
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.addButton, isLoading && styles.addButtonDisabled]}
                            onPress={handleAddContact}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.addButtonText}>Agregar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 20,
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#111827',
    },
    errorContainer: {
        backgroundColor: '#FEE2E2',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#DC2626',
        fontSize: 14,
        textAlign: 'center',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    addButton: {
        flex: 1,
        backgroundColor: '#7FA889',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    addButtonDisabled: {
        backgroundColor: '#9CA3AF',
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
