/**
 * GroupProfileView Component
 * 
 * Displays group information including participants list.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { chatService } from '../../services/chat.service';
import { mediaService } from '../../services/media.service';
import { supabase } from '../../lib/supabase';
import { getLocalContacts, LocalContact } from '../../database/chatDatabase';
import { EditStringModal } from '../modals/EditStringModal';
import { ContactSelectionModal } from '../modals/ContactSelectionModal';
import { useTheme } from '../../contexts/ThemeContext';

interface GroupProfileViewProps {
    conversationId: string;
    groupName: string;
    groupDescription?: string;
    groupImage?: string;
    userId: string; // Current user ID
    onBack: () => void;
    onLeave?: () => void;
    onUpdate?: (updates: { title?: string; imageUrl?: string; description?: string }) => void;
}

interface Participant {
    id: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    role: 'admin' | 'member';
}

export function GroupProfileView({
    conversationId,
    groupName,
    groupDescription,
    groupImage,
    userId,
    onBack,
    onLeave,
    onUpdate,
}: GroupProfileViewProps) {
    const { colors, isDark } = useTheme();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member'>('member');
    const [localDescription, setLocalDescription] = useState(groupDescription || '');
    const [localContacts, setLocalContacts] = useState<LocalContact[]>([]);

    // Modals state
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editModalConfig, setEditModalConfig] = useState<{
        title: string;
        initialValue: string;
        placeholder: string;
        field: 'title' | 'description';
    }>({ title: '', initialValue: '', placeholder: '', field: 'title' });

    const [addParticipantVisible, setAddParticipantVisible] = useState(false);

    const fetchLocalContacts = () => {
        try {
            const contacts = getLocalContacts(userId);
            setLocalContacts(contacts);
        } catch (error) {
            console.error('Error fetching local contacts:', error);
        }
    };

    const fetchParticipants = async () => {
        setIsLoading(true);
        try {
            const data = await chatService.getGroupParticipants(conversationId);
            setParticipants(data);

            // Set current user role
            const me = data.find(p => p.id === userId);
            if (me) setCurrentUserRole(me.role as 'admin' | 'member');
        } catch (error) {
            console.error('Error fetching participants via API Gateway:', error);
            Alert.alert('Error', 'No se pudieron cargar los participantes del grupo');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchParticipants();
        fetchLocalContacts();
    }, [conversationId]);

    const handlePromoteToAdmin = (p: Participant) => {
        Alert.alert(
            'Promover a Administrador',
            `¿Deseas promover a ${getDisplayName(p)} como administrador del grupo?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Promover',
                    onPress: async () => {
                        try {
                            setIsUpdating(true);
                            await chatService.promoteToAdmin(conversationId, userId, p.id);
                            await fetchParticipants();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo promover al usuario');
                        } finally {
                            setIsUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRemoveParticipant = (p: Participant) => {
        Alert.alert(
            'Eliminar del Grupo',
            `¿Estás seguro de que deseas eliminar a ${getDisplayName(p)} del grupo?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsUpdating(true);
                            await chatService.removeParticipant(conversationId, userId, p.id);
                            await fetchParticipants();
                        } catch (error) {
                            Alert.alert('Error', 'No se pudo eliminar al usuario');
                        } finally {
                            setIsUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    const handleLeaveGroup = () => {
        Alert.alert(
            'Salir del Grupo',
            '¿Estás seguro de que deseas salir de este grupo?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Salir',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsUpdating(true);
                            await chatService.leaveGroup(conversationId, userId);
                            if (onLeave) {
                                onLeave();
                            } else {
                                onBack();
                            }
                        } catch (error: unknown) {
                            const err = error as { message?: string };
                            Alert.alert('Error', err.message || 'No se pudo salir del grupo');
                        } finally {
                            setIsUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    const handleAddParticipant = () => {
        if (currentUserRole !== 'admin') return;
        setAddParticipantVisible(true);
    };

    const onParticipantSelected = async (contactUserId: string) => {
        try {
            setAddParticipantVisible(false);
            setIsUpdating(true);
            await chatService.addParticipant(conversationId, userId, contactUserId);
            await fetchParticipants();
            Alert.alert('Éxito', 'Usuario añadido correctamente');
        } catch (error: unknown) {
            const err = error as { message?: string };
            Alert.alert('Error', err.message || 'No se pudo añadir al usuario');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateGroupImage = async () => {
        if (currentUserRole !== 'admin') return;

        try {
            // 1. Permission
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert('Permiso requerido', 'Se requiere acceso a la galería para cambiar la foto del grupo.');
                return;
            }

            // 2. Pick image
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (result.canceled || !result.assets[0]) return;

            setIsUpdating(true);
            const asset = result.assets[0];

            // 3. Upload image
            const uploadResult = await mediaService.uploadMedia({
                uri: asset.uri,
                type: 'image',
                fileName: asset.fileName || `group_${conversationId}_${Date.now()}.jpg`,
                mimeType: asset.mimeType || 'image/jpeg'
            });

            if (!uploadResult.url) {
                throw new Error('No se recibió la URL de la imagen');
            }

            // 4. Update group in DB
            await chatService.updateGroup({
                conversationId,
                adminId: userId,
                imageUrl: uploadResult.url
            });

            if (onUpdate) {
                onUpdate({ imageUrl: uploadResult.url });
            }

            Alert.alert('Éxito', 'Foto del grupo actualizada correctamente');
        } catch (error: unknown) {
            console.error('Error updating group image:', error);
            const err = error as { message?: string };
            Alert.alert('Error', 'No se pudo actualizar la foto: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpdateTitle = () => {
        if (currentUserRole !== 'admin') return;
        setEditModalConfig({
            title: 'Cambiar Nombre del Grupo',
            initialValue: groupName,
            placeholder: 'Nuevo nombre',
            field: 'title'
        });
        setEditModalVisible(true);
    };

    const handleUpdateDescription = () => {
        if (currentUserRole !== 'admin') return;
        setEditModalConfig({
            title: 'Cambiar Descripción',
            initialValue: localDescription,
            placeholder: 'Descripción del grupo',
            field: 'description'
        });
        setEditModalVisible(true);
    };

    const onSaveString = async (value: string) => {
        setEditModalVisible(false);
        if (!value.trim() && editModalConfig.field === 'title') return;

        try {
            setIsUpdating(true);
            const updates: { conversationId: string; adminId: string; title?: string; description?: string } = { 
                conversationId, 
                adminId: userId 
            };

            if (editModalConfig.field === 'title') {
                updates.title = value.trim();
            } else {
                updates.description = value.trim();
            }

            await chatService.updateGroup(updates);

            if (editModalConfig.field === 'title') {
                if (onUpdate) onUpdate({ title: value.trim() });
            } else {
                setLocalDescription(value.trim());
                if (onUpdate) onUpdate({ description: value.trim() });
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la información');
        } finally {
            setIsUpdating(false);
        }
    };

    const getDisplayName = (p: Participant) => {
        // 1. Try to find in local contacts for alias/custom name
        const contact = localContacts.find(c => c.contact_user_id === p.id);
        if (contact) {
            return contact.alias ||
                `${contact.custom_first_name || ''} ${contact.custom_last_name || ''}`.trim() ||
                contact.phone ||
                p.phone ||
                'Usuario';
        }

        // 2. Fallback to profile names
        if (p.firstName || p.lastName) {
            return `${p.firstName || ''} ${p.lastName || ''}`.trim();
        }
        return p.phone || 'Usuario';
    };

    const getInitial = (p: Participant) => {
        const name = getDisplayName(p);
        return name.charAt(0).toUpperCase();
    };

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <ScrollView style={{ flex: 1 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Info del Grupo</Text>
                    {isUpdating && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 12 }} />}
                </View>

                {/* Group Avatar & Name */}
                <View style={{ alignItems: 'center', padding: 32, backgroundColor: colors.card }}>
                    <TouchableOpacity
                        onPress={handleUpdateGroupImage}
                        disabled={currentUserRole !== 'admin'}
                        style={{ position: 'relative' }}
                    >
                        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            {groupImage ? (
                                <Image source={{ uri: groupImage }} style={{ width: 120, height: 120, borderRadius: 60 }} />
                            ) : (
                                <Ionicons name="people" size={60} color="#6B7280" />
                            )}
                        </View>
                        {currentUserRole === 'admin' && (
                            <View style={{ position: 'absolute', bottom: 15, right: 0, backgroundColor: '#10B981', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF' }}>
                                <Ionicons name="camera" size={16} color="#FFFFFF" />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>{groupName}</Text>
                        {currentUserRole === 'admin' && (
                            <TouchableOpacity onPress={handleUpdateTitle} style={{ marginLeft: 8 }}>
                                <Ionicons name="pencil" size={18} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Grupo · {participants.length} participantes</Text>
                </View>

                {/* Description Section */}
                <View style={{ backgroundColor: colors.card, padding: 16, marginTop: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Descripción</Text>
                        {currentUserRole === 'admin' && (
                            <TouchableOpacity onPress={handleUpdateDescription}>
                                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>Editar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={{ fontSize: 16, color: localDescription ? colors.text : colors.textMuted, fontStyle: localDescription ? 'normal' : 'italic' }}>
                        {localDescription || 'Sin descripción'}
                    </Text>
                </View>

                {/* Participants Section */}
                <View style={{ backgroundColor: colors.card, marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                            {participants.length} participantes
                        </Text>
                        {currentUserRole === 'admin' && (
                            <TouchableOpacity
                                onPress={handleAddParticipant}
                                style={{ flexDirection: 'row', alignItems: 'center' }}
                            >
                                <Ionicons name="person-add-outline" size={16} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600', marginLeft: 4 }}>Añadir</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isLoading ? (
                        <View style={{ padding: 32, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#10B981" />
                        </View>
                    ) : (
                        participants.map((participant) => (
                            <TouchableOpacity
                                key={participant.id}
                                disabled={currentUserRole !== 'admin' || participant.id === userId}
                                onPress={() => {
                                    if (currentUserRole === 'admin' && participant.id !== userId) {
                                        Alert.alert(
                                            'Acciones de Usuario',
                                            `¿Qué deseas hacer con ${getDisplayName(participant)}?`,
                                            [
                                                { text: 'Cancelar', style: 'cancel' },
                                                participant.role !== 'admin' ?
                                                    { text: 'Hacer Administrador', onPress: () => handlePromoteToAdmin(participant) } :
                                                    null,
                                                { text: 'Eliminar del Grupo', style: 'destructive', onPress: () => handleRemoveParticipant(participant) }
                                            ].filter(Boolean) as any
                                        );
                                    }
                                }}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 16,
                                    paddingVertical: 12,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                            >
                                {/* Avatar */}
                                <View style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: '#D1D5DB',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 12,
                                }}>
                                    {participant.avatarUrl ? (
                                        <Image
                                            source={{ uri: participant.avatarUrl }}
                                            style={{ width: 44, height: 44, borderRadius: 22 }}
                                        />
                                    ) : (
                                        <Text style={{ color: '#374151', fontWeight: 'bold', fontSize: 16 }}>
                                            {getInitial(participant)}
                                        </Text>
                                    )}
                                </View>

                                {/* Name & Phone */}
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: '500', color: colors.text }}>
                                            {getDisplayName(participant)}
                                            {participant.id === userId && ' (Tú)'}
                                        </Text>
                                        {participant.role === 'admin' && (
                                            <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 }}>
                                                <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>Admin</Text>
                                            </View>
                                        )}
                                    </View>
                                    {participant.phone && (
                                        <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                                            {participant.phone}
                                        </Text>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Group Settings / Actions */}
                <View style={{ backgroundColor: colors.card, marginTop: 16 }}>
                    <TouchableOpacity
                        onPress={handleLeaveGroup}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}
                    >
                        <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                        <Text style={{ fontSize: 16, color: '#EF4444', fontWeight: '600', marginLeft: 12 }}>Salir del grupo</Text>
                    </TouchableOpacity>
                </View>

                {/* Bottom Spacing */}
                <View style={{ height: 60 }} />
            </ScrollView>

            <EditStringModal
                visible={editModalVisible}
                title={editModalConfig.title}
                initialValue={editModalConfig.initialValue}
                placeholder={editModalConfig.placeholder}
                onSave={onSaveString}
                onCancel={() => setEditModalVisible(false)}
            />

            <ContactSelectionModal
                visible={addParticipantVisible}
                userId={userId}
                existingParticipantIds={new Set(participants.map(p => p.id))}
                onSelect={onParticipantSelected}
                onClose={() => setAddParticipantVisible(false)}
            />
        </View>
    );
}

