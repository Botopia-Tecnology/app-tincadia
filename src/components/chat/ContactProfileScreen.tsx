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
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contactService, Contact, UpdateContactDto } from '../../services/contact.service';
import { chatService } from '../../services/chat.service';
import { saveContact, getMediaForConversation, saveMediaUrl, getMediaUrl } from '../../database/chatDatabase';
import { contactProfileStyles as styles } from '../../styles/ContactProfile.styles';
import { BackArrowIcon } from '../icons/NavigationIcons';
import { mediaService } from '../../services/media.service';

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
    conversationId?: string;
    onBack: () => void;
    onContactUpdated?: (contact: Contact) => void;
    onContactAdded?: (contact: Contact) => void;
}

interface UserProfile {
    firstName?: string;
    lastName?: string;
    phone?: string;
}

interface MediaItem {
    id: string;
    url: string;
    type: 'image' | 'audio';
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
    conversationId,
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

    // Original user profile (for non-contacts or when phone is missing)
    const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null);

    // Media shared in conversation
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);

    // Fetch original user profile if not a saved contact OR if phone is missing
    useEffect(() => {
        const fetchOriginalProfile = async () => {
            if (otherUserId && (!otherUserPhone || !isContact)) {
                setIsLoading(true);
                try {
                    // Get profiles from the conversation or a profile endpoint
                    const response = await chatService.getUserProfile(otherUserId);
                    // Backend returns { user: {...} }
                    const userData = response?.user || response?.profile;
                    if (userData) {
                        setOriginalProfile({
                            firstName: userData.firstName || userData.first_name,
                            lastName: userData.lastName || userData.last_name,
                            phone: userData.phone,
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
    }, [isContact, otherUserId, otherUserPhone]);

    // Fetch media shared in conversation (cache-first)
    useEffect(() => {
        const fetchMedia = async () => {
            if (!conversationId) return;

            setIsLoadingMedia(true);
            try {
                // 1. First, try to load from local cache (instant)
                const cachedMedia = getMediaForConversation(conversationId);
                if (cachedMedia.length > 0) {
                    setMediaItems(cachedMedia.map(m => ({
                        id: m.storageKey,
                        url: m.publicUrl,
                        type: m.type === 'video' ? 'image' : m.type,
                    })));
                    setIsLoadingMedia(false);
                    // Don't return - still check for new media in background
                }

                // 2. Get messages from backend to check for new media
                const { messages } = await chatService.getMessages(conversationId);

                // Filter only image messages
                const imageMessages = messages
                    .filter(msg => msg.type === 'image')
                    .slice(-10); // Get last 10 media

                // 3. For each media, check cache first, then fetch if needed
                const mediaWithUrls: MediaItem[] = [];
                for (const msg of imageMessages) {
                    const storageKey = msg.content;

                    // Check cache first
                    let url = getMediaUrl(storageKey);

                    if (!url) {
                        // Not in cache - fetch from backend and cache it
                        try {
                            url = await mediaService.downloadMedia(storageKey);
                            // Save to cache for future use
                            saveMediaUrl({
                                storageKey,
                                publicUrl: url,
                                conversationId,
                                type: 'image',
                            });
                        } catch (e) {
                            console.error('Error getting media URL:', e);
                            continue;
                        }
                    }

                    mediaWithUrls.push({
                        id: msg.id,
                        url,
                        type: 'image',
                    });
                }

                setMediaItems(mediaWithUrls);
            } catch (err) {
                console.error('Error fetching media:', err);
            } finally {
                setIsLoadingMedia(false);
            }
        };

        fetchMedia();
    }, [conversationId]);

    // Get effective phone number
    const getPhone = () => {
        return otherUserPhone || originalProfile?.phone || null;
    };

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
        const phoneToUse = getPhone();
        if (!phoneToUse) return;

        setIsSaving(true);
        try {
            const { contact } = await contactService.addContact({
                ownerId: userId,
                phone: phoneToUse,
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

    const effectivePhone = getPhone();

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#7FA889" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header Section */}
                <View style={styles.header}>
                    {/* Navigation Row */}
                    <View style={styles.headerNavRow}>
                        <TouchableOpacity style={styles.backButton} onPress={onBack}>
                            <BackArrowIcon size={24} color="#111827" />
                        </TouchableOpacity>

                        {isContact && !isEditing && (
                            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
                                <Text style={styles.editButtonText}>Editar</Text>
                            </TouchableOpacity>
                        )}

                        {/* Spacer when no edit button */}
                        {(!isContact || isEditing) && <View style={{ width: 40 }} />}
                    </View>

                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarLarge}>
                            <Text style={styles.avatarText}>{getAvatarInitial()}</Text>
                        </View>
                    </View>

                    {/* Name and Phone */}
                    <Text style={styles.headerName}>{getDisplayName()}</Text>
                    <Text style={styles.headerPhone}>{effectivePhone || 'Sin teléfono'}</Text>

                    {/* Show original name if viewing non-contact */}
                    {!isContact && originalProfile && (originalProfile.firstName || originalProfile.lastName) && (
                        <Text style={styles.originalName}>
                            Nombre original: {`${originalProfile.firstName || ''} ${originalProfile.lastName || ''}`.trim()}
                        </Text>
                    )}
                </View>

                {/* Contact Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información del Contacto</Text>

                    {/* Phone (read-only) */}
                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>Teléfono</Text>
                        <View style={styles.phoneContainer}>
                            <Text style={styles.phoneText}>{effectivePhone || 'No disponible'}</Text>
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
                                placeholderTextColor="#6B7280"
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
                                placeholderTextColor="#6B7280"
                            />
                        ) : (
                            <Text style={firstName ? styles.fieldValue : styles.fieldValueEmpty}>
                                {firstName || 'Sin nombre'}
                            </Text>
                        )}
                    </View>

                    {/* Last Name */}
                    <View style={[styles.field, styles.fieldLast]}>
                        <Text style={styles.fieldLabel}>Apellido</Text>
                        {isEditing || !isContact ? (
                            <TextInput
                                style={styles.input}
                                value={lastName || (originalProfile?.lastName || '')}
                                onChangeText={setLastName}
                                placeholder="Apellido"
                                placeholderTextColor="#6B7280"
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

                {/* Shared Media Section */}
                {(mediaItems.length > 0 || isLoadingMedia) && (
                    <View style={styles.section}>
                        <View style={styles.mediaSectionHeader}>
                            <Text style={styles.sectionTitle}>
                                Archivos, enlaces y docs
                            </Text>
                            <Text style={styles.mediaCount}>{mediaItems.length}</Text>
                        </View>

                        {isLoadingMedia ? (
                            <View style={styles.mediaLoading}>
                                <ActivityIndicator size="small" color="#7FA889" />
                            </View>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.mediaGrid}
                            >
                                {mediaItems.map((item) => (
                                    <View key={item.id} style={styles.mediaItem}>
                                        <Image
                                            source={{ uri: item.url }}
                                            style={styles.mediaImage}
                                            resizeMode="cover"
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                )}

                {/* Bottom spacing */}
                <View style={{ height: 32 }} />
            </ScrollView>
        </SafeAreaView>
    );
}
