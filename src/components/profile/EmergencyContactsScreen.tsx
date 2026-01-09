/**
 * Emergency Contacts Screen
 * Allows users to add/edit/remove emergency contacts for WhatsApp alerts
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { KeyboardSafeView } from '../common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { BackArrowIcon, ChevronRightIcon } from '../icons/NavigationIcons';
import { Plus, Trash2, Phone, User } from 'lucide-react-native';
import { emergencyContactsStorage, EmergencyContact } from '../../services/emergencyContacts.storage';
import { CountryCodePicker, defaultCountry } from '../common/CountryCodePicker';

interface Props {
    onBack: () => void;
}

export function EmergencyContactsScreen({ onBack }: Props) {
    const [contacts, setContacts] = useState<EmergencyContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(defaultCountry);

    useEffect(() => {
        loadContacts();
    }, []);

    const loadContacts = async () => {
        setIsLoading(true);
        const data = await emergencyContactsStorage.getContacts();
        setContacts(data);
        setIsLoading(false);
    };

    const handleAddContact = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            Alert.alert('Error', 'Por favor ingresa nombre y teléfono');
            return;
        }

        // Format phone with selected country code
        const formattedPhone = `${selectedCountry.dialCode}${newPhone.trim().replace(/^0+/, '')}`;

        try {
            await emergencyContactsStorage.addContact({
                name: newName.trim(),
                phone: formattedPhone,
            });
            setNewName('');
            setNewPhone('');
            setSelectedCountry(defaultCountry);
            setShowAddForm(false);
            await loadContacts();
            Alert.alert('Éxito', 'Contacto de emergencia agregado');
        } catch (error) {
            Alert.alert('Error', 'No se pudo agregar el contacto');
        }
    };

    const handleRemoveContact = async (contact: EmergencyContact) => {
        Alert.alert(
            'Eliminar contacto',
            `¿Eliminar a ${contact.name}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        await emergencyContactsStorage.removeContact(contact.id);
                        await loadContacts();
                    },
                },
            ]
        );
    };

    return (
        <KeyboardSafeView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <BackArrowIcon size={32} color="#000000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contactos de Emergencia</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => setShowAddForm(true)}
                >
                    <Plus size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                <Text style={styles.description}>
                    Estos contactos recibirán un mensaje de WhatsApp con tu ubicación cuando actives una emergencia.
                </Text>

                {isLoading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 40 }} />
                ) : contacts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Phone size={48} color="#CCC" />
                        <Text style={styles.emptyText}>No tienes contactos de emergencia</Text>
                        <Text style={styles.emptySubtext}>Agrega a familiares o amigos que puedan ayudarte</Text>
                    </View>
                ) : (
                    <View style={styles.contactsList}>
                        {contacts.map((contact) => (
                            <View key={contact.id} style={styles.contactItem}>
                                <View style={styles.contactIcon}>
                                    <User size={20} color="#666" />
                                </View>
                                <View style={styles.contactInfo}>
                                    <Text style={styles.contactName}>{contact.name}</Text>
                                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleRemoveContact(contact)}
                                >
                                    <Trash2 size={20} color="#FF3B30" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Add Contact Form */}
                {showAddForm && (
                    <View style={styles.addForm}>
                        <Text style={styles.formTitle}>Nuevo Contacto</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre (ej: Mamá, Papá)"
                            placeholderTextColor="#999"
                            value={newName}
                            onChangeText={setNewName}
                        />
                        <View style={styles.phoneInputRow}>
                            <CountryCodePicker
                                selectedCountry={selectedCountry}
                                onSelect={setSelectedCountry}
                            />
                            <TextInput
                                style={[styles.input, styles.phoneInput]}
                                placeholder="3001234567"
                                placeholderTextColor="#999"
                                value={newPhone}
                                onChangeText={setNewPhone}
                                keyboardType="phone-pad"
                            />
                        </View>
                        <View style={styles.formButtons}>
                            <TouchableOpacity
                                style={[styles.formButton, styles.cancelButton]}
                                onPress={() => {
                                    setShowAddForm(false);
                                    setNewName('');
                                    setNewPhone('');
                                }}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.formButton, styles.saveButton]}
                                onPress={handleAddContact}
                            >
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </KeyboardSafeView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#000',
    },
    addButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        lineHeight: 20,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#999',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#BBB',
        marginTop: 8,
        textAlign: 'center',
    },
    contactsList: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        overflow: 'hidden',
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    contactIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactInfo: {
        flex: 1,
        marginLeft: 12,
    },
    contactName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
    contactPhone: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    deleteButton: {
        padding: 8,
    },
    addForm: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
        color: '#000',
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        marginBottom: 12,
    },
    phoneInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    phoneInput: {
        flex: 1,
        marginBottom: 0,
    },
    formButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    formButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: '#F0F0F0',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    cancelButtonText: {
        color: '#666',
        fontWeight: '600',
    },
    saveButtonText: {
        color: '#FFF',
        fontWeight: '600',
    },
});
