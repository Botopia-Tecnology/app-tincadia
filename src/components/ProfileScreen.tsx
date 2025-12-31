import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, Alert, ActivityIndicator, Platform } from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { profileScreenStyles as styles } from '../styles/ProfileScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { profilePictureService } from '../services/profilePicture.service';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
    BackArrowIcon,
    SearchIcon,
    AccountIcon,
    PrivacyIcon,
    HelpIcon,
    InviteIcon,
    ChevronRightIcon,
    CameraIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';

import { appNotificationService } from '../services/appNotification.service';
import * as Notifications from 'expo-notifications';

interface ProfileScreenProps {
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
    onBack: () => void;
    userId?: string;
    onShowNotifications?: () => void;
}

export function ProfileScreen({
    onNavigate,
    onBack,
    userId,
    onShowNotifications,
}: ProfileScreenProps) {
    const { user, logout, isLoading, refreshProfile } = useAuth();
    const [isUploading, setIsUploading] = useState(false);

    const handleEditAvatar = async () => {
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

    const handleTestPush = async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Habilita las notificaciones en la configuración de tu dispositivo.');
                return;
            }

            // Send Remote Push via Backend
            const tokenData = await Notifications.getExpoPushTokenAsync();
            console.log('📱 Testing Push with Token:', tokenData.data);

            if (user?.id) {
                await appNotificationService.sendTestPush(user.id, tokenData.data);
                Alert.alert('Enviado', 'Notificación de prueba enviada 🚀');
            }
        } catch (error) {
            console.error('Test Push Error:', error);
            Alert.alert('Error', 'No se pudo enviar la notificación de prueba.');
        }
    };

    const handleLogout = () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro de que deseas cerrar sesión?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cerrar Sesión',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    }
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
                <Text style={styles.headerTitle}>Perfil</Text>
                {userId && onShowNotifications ? (
                    <NotificationBell
                        userId={userId}
                        onPress={onShowNotifications}
                        color="#000000"
                    />
                ) : (
                    <View style={styles.notificationButton} />
                )}
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View style={styles.searchIcon}>
                        <SearchIcon size={20} color="#999999" />
                    </View>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar"
                        placeholderTextColor="#999999"
                    />
                </View>

                {/* Profile Section */}
                <View style={styles.profileSection}>
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={handleEditAvatar}
                        disabled={isUploading}
                    >
                        {isUploading ? (
                            <View style={[styles.avatar, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
                                <ActivityIndicator color="#0000ff" />
                            </View>
                        ) : (
                            <Image
                                source={user?.avatarUrl ? { uri: user.avatarUrl } : require('../../assets/user.png')}
                                style={styles.avatar}
                            />
                        )}
                        <View style={[styles.badgeIcon, { backgroundColor: '#007AFF', padding: 4, borderRadius: 12 }]}>
                            <CameraIcon size={14} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
                        </Text>
                        {user?.email && (
                            <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{user.email}</Text>
                        )}
                    </View>
                </View>

                {/* Menu Group 1 */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]}>
                        <View style={styles.menuIcon}>
                            <AccountIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Cuenta</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]}>
                        <View style={styles.menuIcon}>
                            <PrivacyIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Privacidad</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIcon}>
                            <ChatIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Chats</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                </View>

                {/* Menu Group 2 */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]}>
                        <Text style={[styles.menuLabel, { marginLeft: 0 }]}>Ayuda</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]}>
                        <View style={styles.menuIcon}>
                            <InviteIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Invitar amigos</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>

                    {/* Test Notification Button */}
                    <TouchableOpacity style={styles.menuItem} onPress={handleTestPush}>
                        <Text style={[styles.menuLabel, { marginLeft: 0, color: '#007AFF' }]}>
                            🔔 Probar Notificación Push
                        </Text>
                        <ChevronRightIcon size={20} color="#007AFF" />
                    </TouchableOpacity>
                </View>

                {/* Logout Button */}
                <TouchableOpacity
                    style={{
                        marginTop: 24,
                        marginHorizontal: 16,
                        backgroundColor: '#FF3B30',
                        paddingVertical: 14,
                        borderRadius: 12,
                        alignItems: 'center',
                    }}
                    onPress={handleLogout}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                            Cerrar Sesión
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <BottomNavigation currentScreen="profile" onNavigate={onNavigate} />
        </KeyboardSafeView>
    );
}

