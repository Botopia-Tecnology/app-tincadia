/**
 * ContactProfileScreen Component
 * 
 * WhatsApp-style contact profile view accessible from chat.
 * Shows contact info with ability to edit (except phone number).
 * For non-contacts, shows the user's original registration name.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contactService, Contact, UpdateContactDto } from '../../services/contact.service';
import { chatService } from '../../services/chat.service';
import { saveContact } from '../../database/chatDatabase';
import { contactProfileStyles as styles } from '../../styles/ContactProfile.styles';
import { BackArrowIcon } from '../icons/NavigationIcons';

export interface ContactProfileProps {
    userId: string;
    otherUserId: string;
    otherUserPhone?: string;
    contactId?: string;
    isContact: boolean;
    displayName: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
    onBack: () => void;
    onContactUpdated?: (contact: Contact) => void;
    onContactAdded?: (contact: Contact) => void;
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    phone?: string;
}

export function ContactProfileScreen({
    userId,
    otherUserId,
    otherUserPhone,
    contactId,
    isContact,
    displayName,
    alias: initialAlias,
    customFirstName: initialFirstName,
    customLastName: initialLastName,
    onBack,
    onContactUpdated,
    onContactAdded,
}: ContactProfileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [alias, setAlias] = useState(initialAlias || '');
    const [firstName, setFirstName] = useState(initialFirstName || '');
    const [lastName, setLastName] = useState(initialLastName || '');

    // Original user profile (for non-contacts)
    const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);

    // Fetch original user profile if not a saved contact
    useEffect(() => {
        const fetchOriginalProfile = async () => {
            if (!isContact && otherUserId) {
                setIsLoading(true);
                try {
                    // Get profiles from the conversation or a profile endpoint
                    const response = await chatService.getUserProfile(otherUserId);
                    if (response?.profile) {
                        setOriginalProfile({
                            firstName: response.profile.firstName || response.profile.first_name,
                            lastName: response.profile.lastName || response.profile.last_name,
                            phone: response.profile.phone,
                        });
                    }
                } catch (err) {
                    console.error('Error fetching user profile:', err);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchOriginalProfile();
    }, [isContact, otherUserId]);

    const handleSave = async () => {
        if (!contactId) return;

        setIsSaving(true);
        try {
            const updateData: UpdateContactDto = {
                alias: alias.trim() || undefined,
                customFirstName: firstName.trim() || undefined,
                customLastName: lastName.trim() || undefined,
            };

            const { contact } = await contactService.updateContact(contactId, updateData);

            // Update local cache
            saveContact({
                id: contact.id,
                ownerId: contact.ownerId || userId,
                contactUserId: contact.contactUserId,
                phone: contact.phone,
                alias: contact.alias,
                customFirstName: contact.customFirstName,
                customLastName: contact.customLastName,
            });

            setIsEditing(false);
            if (onContactUpdated) {
                onContactUpdated(contact);
            }
        } catch (err) {
            console.error('Error updating contact:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddContact = async () => {
        if (!otherUserPhone) return;

        setIsSaving(true);
        try {
            const { contact } = await contactService.addContact({
                ownerId: userId,
                phone: otherUserPhone,
                alias: alias.trim() || undefined,
                customFirstName: firstName.trim() || originalProfile?.firstName || undefined,
                customLastName: lastName.trim() || originalProfile?.lastName || undefined,
            });

            // Save to local cache
            saveContact({
                id: contact.id,
                ownerId: contact.ownerId || userId,
                contactUserId: contact.contactUserId,
                phone: contact.phone,
                alias: contact.alias,
                customFirstName: contact.customFirstName,
                customLastName: contact.customLastName,
            });

            if (onContactAdded) {
                onContactAdded(contact);
            }
            onBack();
        } catch (err) {
            console.error('Error adding contact:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setAlias(initialAlias || '');
        setFirstName(initialFirstName || '');
        setLastName(initialLastName || '');
        setIsEditing(false);
    };

    // Get display name for header
    const getDisplayName = () => {
        if (alias) return alias;
        if (firstName || lastName) return `${firstName} ${lastName}`.trim();
        return displayName;
    };

    // Get avatar initial
    const getAvatarInitial = () => {
        const name = getDisplayName();
        return name.charAt(0).toUpperCase();
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#075E54" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header with Avatar */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <BackArrowIcon size={24} color="#FFFFFF" />
                </TouchableOpacity>

                {isContact && !isEditing && (
                    <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                        <Text style={styles.editButtonText}>Editar</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.avatarLarge}>
                    <Text style={styles.avatarText}>{getAvatarInitial()}</Text>
                </View>

                <Text style={styles.headerName}>{getDisplayName()}</Text>
                <Text style={styles.headerPhone}>{otherUserPhone || 'Sin teléfono'}</Text>

                {/* Show original name if viewing non-contact */}
                {!isContact && originalProfile && (originalProfile.firstName || originalProfile.lastName) && (
                    <Text style={styles.originalName}>
                        Nombre original: {`${originalProfile.firstName || ''} ${originalProfile.lastName || ''}`.trim()}
                    </Text>
                )}
            </View>

            {/* Content */}
            <ScrollView style={styles.content}>
                {/* Contact Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información del Contacto</Text>

                    {/* Phone (read-only) */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Teléfono</Text>
                        <View style={styles.phoneContainer}>
                            <Text style={styles.phoneText}>{otherUserPhone || 'No disponible'}</Text>
                            <Text style={styles.phoneLock}>🔒</Text>
                        </View>
                    </View>

                    {/* Alias */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Alias / Apodo</Text>
                        {isEditing || !isContact ? (
                            <TextInput
                                style={styles.input}
                                value={alias}
                                onChangeText={setAlias}
                                placeholder="Ej: Mamá, Trabajo, etc."
                                placeholderTextColor="#999"
                            />
                        ) : (
                            <Text style={alias ? styles.fieldValue : styles.fieldValueEmpty}>
                                {alias || 'Sin alias'}
                            </Text>
                        )}
                    </View>

                    {/* First Name */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Nombre</Text>
                        {isEditing || !isContact ? (
                            <TextInput
                                style={styles.input}
                                value={firstName || (originalProfile?.firstName || '')}
                                onChangeText={setFirstName}
                                placeholder="Nombre"
                                placeholderTextColor="#999"
                            />
                        ) : (
                            <Text style={firstName ? styles.fieldValue : styles.fieldValueEmpty}>
                                {firstName || 'Sin nombre'}
                            </Text>
                        )}
                    </View>

                    {/* Last Name */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Apellido</Text>
                        {isEditing || !isContact ? (
                            <TextInput
                                style={styles.input}
                                value={lastName || (originalProfile?.lastName || '')}
                                onChangeText={setLastName}
                                placeholder="Apellido"
                                placeholderTextColor="#999"
                            />
                        ) : (
                            <Text style={lastName ? styles.fieldValue : styles.fieldValueEmpty}>
                                {lastName || 'Sin apellido'}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                {isEditing && (
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Guardar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Add Contact Button for non-contacts */}
                {!isContact && (
                    <TouchableOpacity
                        style={styles.addContactButton}
                        onPress={handleAddContact}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={styles.addContactButtonText}>Agregar a Contactos</Text>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
