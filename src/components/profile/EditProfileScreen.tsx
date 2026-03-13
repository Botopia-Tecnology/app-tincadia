import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/AuthContext'; // Adjusted path
import { profilePictureService } from '../../services/profilePicture.service'; // Adjusted path
import { authService } from '../../services/auth.service'; // Adjusted path
import {
    BackArrowIcon,
    CameraIcon,
    ProfileIcon,
    PhoneIcon,
    PencilIcon
} from '../icons/NavigationIcons'; // Adjusted path
import { EditInfoModal } from './EditInfoModal'; // Same directory
import { KeyboardSafeView } from '../common/KeyboardSafeView'; // Adjusted path
import { profileScreenStyles as styles } from '../../styles/ProfileScreen.styles'; // Adjusted path
import { useTheme } from '../../contexts/ThemeContext';

interface EditProfileScreenProps {
    onBack: () => void;
}

export function EditProfileScreen({ onBack }: EditProfileScreenProps) {
    const { user, refreshProfile, logout, isLoading } = useAuth(); // Added logout/isLoading here if we keep the button, 
    // actually user might want logout on the main menu now if it's "Account Settings". 
    // But the previous design had logout. The "WhatsApp style" usually has fields.
    // The user said "the section you created", which included Logout. I will keep it for now or move it?
    // The "Menu" version had logout. I'll check previous file content.
    // Previous menu had logout button at the bottom.
    // New design has logout button.
    // I will KEEP the logout button in the Edit Screen as well if it was part of "what I created", 
    // BUT usually logout is on the main settings list.
    // I'll stick to exact code transfer first.

    const { colors, isDark } = useTheme();

    const [isUploading, setIsUploading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingField, setEditingField] = useState<'firstName' | 'lastName'>('firstName');

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar la foto de perfil.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0].uri && user) {
                setIsUploading(true);
                try {
                    await profilePictureService.uploadProfilePicture(user.id, result.assets[0].uri);
                    await refreshProfile();
                    Alert.alert('Éxito', 'Foto de perfil actualizada correctamente');
                } catch (error) {
                    console.error('Upload Error:', error);
                    Alert.alert('Error', 'No se pudo subir la imagen. Inténtalo de nuevo.');
                } finally {
                    setIsUploading(false);
                }
            }
        } catch (error) {
            console.error('Picker Error:', error);
            setIsUploading(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!user) return;
        Alert.alert(
            'Eliminar Foto',
            '¿Estás seguro de que quieres eliminar tu foto de perfil?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setIsUploading(true);
                        try {
                            await authService.deleteProfilePicture(user.id);
                            await refreshProfile();
                            Alert.alert('Éxito', 'Foto de perfil eliminada.');
                        } catch (error) {
                            console.error('Delete Error:', error);
                            Alert.alert('Error', 'No se pudo eliminar la foto.');
                        } finally {
                            setIsUploading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleAvatarPress = () => {
        const buttons: any[] = [
            { text: 'Seleccionar de Galería', onPress: handlePickImage },
            { text: 'Cancelar', style: 'cancel' }
        ];

        if (user?.avatarUrl) {
            buttons.unshift({
                text: 'Eliminar Foto',
                style: 'destructive',
                onPress: handleDeleteAvatar
            });
        }

        Alert.alert(
            'Foto de Perfil',
            'Selecciona una opción',
            buttons
        );
    };

    const handleEditField = (field: 'firstName' | 'lastName') => {
        setEditingField(field);
        setEditModalVisible(true);
    };

    const handleSaveField = async (value: string) => {
        if (!user) return;
        try {
            const updateData: any = {};
            updateData[editingField] = value;
            await authService.updateProfile(user.id, updateData);
            await refreshProfile();
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'No se pudo actualizar la información.');
            throw error;
        }
    };

    return (
        <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={colors.statusBar} />

            <EditInfoModal
                visible={editModalVisible}
                title={editingField === 'firstName' ? 'Editar Nombre' : 'Editar Apellido'}
                initialValue={user ? (user[editingField] || '') : ''}
                onSave={handleSaveField}
                onCancel={() => setEditModalVisible(false)}
            />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background }]}>
                <TouchableOpacity style={[styles.backButton, { backgroundColor: isDark ? colors.card : '#F5F5F5' }]} onPress={onBack}>
                    <BackArrowIcon size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Información</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={[styles.content, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Profile Avatar Section */}
                <View style={[styles.profileSection, { justifyContent: 'center', marginBottom: 40 }]}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={handleAvatarPress}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <View style={[styles.avatar, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', width: 150, height: 150, borderRadius: 75 }]}>
                                <ActivityIndicator color="#0000ff" size="large" />
                            </View>
                        ) : (
                            <Image
                                source={user?.avatarUrl ? { uri: user.avatarUrl } : require('../../../assets/user.png')} // Adjusted asset path
                                style={{ width: 150, height: 150, borderRadius: 75 }}
                            />
                        )}
                        <View style={[styles.badgeIcon, { backgroundColor: '#007AFF', padding: 8, borderRadius: 20, right: 10, bottom: 10 }]}>
                            <CameraIcon size={20} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Info Fields */}
                <View style={[styles.fieldGroup, { backgroundColor: colors.background, borderColor: colors.border, borderTopWidth: 1, borderBottomWidth: 1 }]}>
                    {/* Name */}
                    <TouchableOpacity style={[styles.fieldItem, { backgroundColor: colors.background }]} onPress={() => handleEditField('firstName')}>
                        <View style={styles.fieldInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ProfileIcon size={20} color={colors.textSecondary} />
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nombre</Text>
                            </View>
                            <Text style={[styles.fieldValue, { color: colors.text }]}>{user?.firstName || 'Sin nombre'}</Text>
                        </View>
                        <PencilIcon size={20} color={colors.primary} />
                    </TouchableOpacity>

                    {/* Last Name */}
                    <TouchableOpacity style={[styles.fieldItem, { backgroundColor: colors.background }]} onPress={() => handleEditField('lastName')}>
                        <View style={styles.fieldInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <ProfileIcon size={20} color={colors.textSecondary} />
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Apellido</Text>
                            </View>
                            <Text style={[styles.fieldValue, { color: colors.text }]}>{user?.lastName || 'Sin apellido'}</Text>
                        </View>
                        <PencilIcon size={20} color={colors.primary} />
                    </TouchableOpacity>

                    <View style={[styles.separator, { backgroundColor: colors.border }]} />

                    {/* Email (Read only) */}
                    <View style={[styles.fieldItem, { backgroundColor: colors.background }]}>
                        <View style={styles.fieldInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.fieldLabel, { marginLeft: 0, color: colors.textSecondary }]}>Correo Electrónico</Text>
                            </View>
                            <Text style={[styles.fieldValue, { color: colors.textMuted }]}>{user?.email}</Text>
                            <Text style={[styles.fieldSubtext, { color: colors.textSecondary }]}>Este campo no se puede modificar.</Text>
                        </View>
                    </View>

                    <View style={[styles.separator, { backgroundColor: colors.border }]} />

                    {/* Phone (Read only) */}
                    <View style={[styles.fieldItem, { backgroundColor: colors.background }]}>
                        <View style={styles.fieldInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <PhoneIcon size={20} color={colors.textSecondary} />
                                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Teléfono</Text>
                            </View>
                            <Text style={[styles.fieldValue, { color: colors.textMuted }]}>{user?.phone || 'No registrado'}</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </KeyboardSafeView>
    );
}
