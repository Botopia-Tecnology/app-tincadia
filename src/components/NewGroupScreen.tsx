import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Image,
    SafeAreaView,
    Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { chatService } from '../services/chat.service';
import { contactService, Contact } from '../services/contact.service';
import { BackArrowIcon, CheckIcon } from './icons/NavigationIcons';
import { useAlert } from '../components/common/CustomAlert';
import { useAppContacts } from '../hooks/useAppContacts';
import * as ImagePicker from 'expo-image-picker';
import { mediaService } from '../services/media.service';
import { Ionicons } from '@expo/vector-icons';

interface NewGroupScreenProps {
    onNavigate: (screen: 'chats', params?: any) => void;
    onBack: () => void;
    userId: string;
}

export function NewGroupScreen({ onNavigate, onBack, userId }: NewGroupScreenProps) {
    const alert = useAlert();
    const [step, setStep] = useState<1 | 2>(1);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [groupImage, setGroupImage] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // Use Delta Sync Hook
    const { contacts, isLoading } = useAppContacts(userId);

    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);

    // Removed manual useEffect and loadContacts


    const toggleContact = (contactId: string) => {
        const newSelected = new Set(selectedContactIds);
        if (newSelected.has(contactId)) {
            newSelected.delete(contactId);
        } else {
            newSelected.add(contactId);
        }
        setSelectedContactIds(newSelected);
    };

    const handleNext = () => {
        if (selectedContactIds.size === 0) {
            alert.show({
                type: 'warning',
                title: 'Atención',
                message: 'Debes seleccionar al menos un participante.'
            });
            return;
        }
        setStep(2);
    };

    const handleSelectImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                alert.show({
                    type: 'error',
                    title: 'Permiso Requerido',
                    message: 'Se necesita acceso a la galería para subir una foto de grupo.'
                });
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (result.canceled || !result.assets[0]) return;

            setIsUploadingImage(true);
            const asset = result.assets[0];

            const uploadResult = await mediaService.uploadMedia({
                uri: asset.uri,
                type: 'image',
                fileName: asset.fileName || `group_temp_${Date.now()}.jpg`,
                mimeType: asset.mimeType || 'image/jpeg'
            });

            if (uploadResult.url) {
                setGroupImage(uploadResult.url);
            }
        } catch (error) {
            console.error('Error uploading group image:', error);
            alert.show({
                type: 'error',
                title: 'Error de carga',
                message: 'No se pudo subir la imagen del grupo.'
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleCreateGroup = async () => {
        if (!title.trim()) {
            alert.show({
                type: 'warning',
                title: 'Atención',
                message: 'El grupo debe tener un nombre.'
            });
            return;
        }

        setIsCreating(true);
        try {
            const { conversationId } = await chatService.createGroup({
                creatorId: userId,
                title: title.trim(),
                description: description.trim(),
                participants: Array.from(selectedContactIds),
                imageUrl: groupImage || undefined,
            });

            // Navigate directly to the group chat
            onNavigate('chats', {
                conversationId,
                isGroup: true,
                groupTitle: title.trim(),
                groupDescription: description.trim(),
            });
        } catch (error: any) {
            alert.show({
                type: 'error',
                title: 'Error',
                message: error.message || 'No se pudo crear el grupo.'
            });
        } finally {
            setIsCreating(false);
        }
    };

    const renderContactItem = ({ item }: { item: Contact }) => {
        const participantId = item.contactUserId;
        const isSelected = selectedContactIds.has(participantId);
        const displayName = item.alias || item.customFirstName || item.phone;
        const initials = displayName.charAt(0).toUpperCase();

        return (
            <TouchableOpacity
                style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                onPress={() => toggleContact(participantId)}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                    {isSelected && (
                        <View style={styles.checkBadge}>
                            <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.contactName}>{displayName}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={step === 1 ? onBack : () => setStep(1)} style={styles.backButton}>
                    <BackArrowIcon color="#374151" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>{step === 1 ? 'Nuevo Grupo' : 'Info del Grupo'}</Text>
                    <Text style={styles.headerSubtitle}>
                        {step === 1 ? 'Añadir participantes' : `${selectedContactIds.size} seleccionados`}
                    </Text>
                </View>
            </View>

            <View style={styles.content}>
                {step === 1 ? (
                    <>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={contacts}
                                keyExtractor={(item) => item.id}
                                renderItem={renderContactItem}
                                contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                                ListEmptyComponent={() => (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 50 }}>
                                        <Text style={{ fontSize: 48, marginBottom: 16 }}>👥</Text>
                                        <Text style={{ color: '#6B7280', fontSize: 16, textAlign: 'center' }}>
                                            No tienes contactos guardados.
                                        </Text>
                                        <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                                            Añade contactos desde la pantalla de chats para crear un grupo.
                                        </Text>
                                    </View>
                                )}
                            />
                        )}

                        {/* FAB Next */}
                        {selectedContactIds.size > 0 && (
                            <TouchableOpacity style={styles.fab} onPress={handleNext}>
                                <Text style={styles.fabText}>→</Text>
                            </TouchableOpacity>
                        )}
                    </>
                ) : (
                    <View style={styles.step2Container}>
                        {/* Image Picker */}
                        <View style={styles.imageSection}>
                            <TouchableOpacity
                                style={styles.imagePickerOuter}
                                onPress={handleSelectImage}
                                disabled={isUploadingImage}
                            >
                                <View style={styles.imagePickerInner}>
                                    {groupImage ? (
                                        <Image source={{ uri: groupImage }} style={styles.imagePreview} />
                                    ) : (
                                        <Ionicons name="people" size={60} color="#9CA3AF" />
                                    )}
                                    {isUploadingImage && (
                                        <View style={styles.imageOverlay}>
                                            <ActivityIndicator color="white" />
                                        </View>
                                    )}
                                </View>
                                {!isUploadingImage && (
                                    <View style={styles.cameraIconBadge}>
                                        <Ionicons name="camera" size={16} color="white" />
                                    </View>
                                )}
                            </TouchableOpacity>
                            <Text style={styles.imageInfo}>Toca para añadir una foto</Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Nombre del Grupo</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Escribe el nombre del grupo"
                                placeholderTextColor="#9CA3AF"
                                autoFocus
                            />
                        </View>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Descripción (Opcional)</Text>
                            <TextInput
                                style={styles.input}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Descripción del grupo"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.createButton}
                            onPress={handleCreateGroup}
                            disabled={isCreating}
                        >
                            {isCreating ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={styles.createButtonText}>Crear Grupo</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'android' ? 40 : 16,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 16,
        padding: 4,
    },
    headerTitle: {
        color: '#1F2937',
        fontSize: 18,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#6B7280',
        fontSize: 12,
    },
    content: {
        flex: 1,
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    contactItemSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#D1D5DB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        position: 'relative'
    },
    avatarText: {
        color: '#374151',
        fontWeight: 'bold',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#10B981',
        borderRadius: 10,
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF'
    },
    contactName: {
        color: '#1F2937',
        fontSize: 16,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    fabText: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
    },
    step2Container: {
        padding: 24,
        flex: 1,
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        color: '#374151',
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 12,
        color: '#1F2937',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    createButton: {
        backgroundColor: '#10B981',
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    // New styles for image picker
    imageSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    imagePickerOuter: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    imagePickerInner: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraIconBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: '#10B981',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    imageInfo: {
        marginTop: 12,
        color: '#6B7280',
        fontSize: 14,
    }
});
