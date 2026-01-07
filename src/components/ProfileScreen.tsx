import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, Linking, Share } from 'react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { profileScreenStyles as styles } from '../styles/ProfileScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from './common/CustomAlert';
import {
    ChatIcon,
    ProfileIcon,
    BackArrowIcon,
    AccountIcon,
    PrivacyIcon,
    InviteIcon,
    ChevronRightIcon,
    CameraIcon,
    EmergencyContactIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';

import { appNotificationService } from '../services/appNotification.service';
import * as Notifications from 'expo-notifications';
import { EditProfileScreen } from './profile/EditProfileScreen';
import { PrivacyScreen } from './profile/PrivacyScreen';
import { EmergencyContactsScreen } from './profile/EmergencyContactsScreen';

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
    const { user, logout, isLoading } = useAuth();
    const alert = useAlert();
    // Local state to manage sub-screen navigation
    const [subScreen, setSubScreen] = useState<'none' | 'editProfile' | 'privacy' | 'emergencyContacts'>('none');

    const handleTestPush = async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                alert.show({
                    type: 'warning',
                    title: 'Permiso denegado',
                    message: 'Habilita las notificaciones en la configuración de tu dispositivo.',
                });
                return;
            }
            const tokenData = await Notifications.getExpoPushTokenAsync();
            console.log('📱 Testing Push with Token:', tokenData.data);
            if (user?.id) {
                await appNotificationService.sendTestPush(user.id, tokenData.data);
                alert.show({
                    type: 'success',
                    title: 'Enviado',
                    message: 'Notificación de prueba enviada 🚀',
                });
            }
        } catch (error) {
            console.error('Test Push Error:', error);
            alert.show({
                type: 'error',
                title: 'Error',
                message: 'No se pudo enviar la notificación de prueba.',
            });
        }
    };

    const handleInviteFriends = async () => {
        try {
            const url = 'https://tincadia.com/';
            const message = `¡Únete conmigo a Tincadia! La mejor plataforma inclusiva para conectar. ${url}`;

            await Share.share({
                message: message, // Android (and iOS fallback)
                url: url, // iOS
                title: 'Invitar amigos a Tincadia',
            });
        } catch (error) {
            console.error('Error sharing:', error);
            alert.show({
                type: 'error',
                title: 'Error',
                message: 'No se pudo abrir el menú de compartir.',
            });
        }
    };

    const handleLogout = () => {
        alert.show({
            type: 'confirm',
            title: 'Cerrar Sesión',
            message: '¿Estás seguro de que deseas cerrar sesión?',
            buttons: [
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
            ],
        });
    };

    // Render Sub-Screen if active
    if (subScreen === 'editProfile') {
        return <EditProfileScreen onBack={() => setSubScreen('none')} />;
    }

    if (subScreen === 'privacy') {
        return <PrivacyScreen onBack={() => setSubScreen('none')} />;
    }

    if (subScreen === 'emergencyContacts') {
        return <EmergencyContactsScreen onBack={() => setSubScreen('none')} />;
    }

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
                {/* Profile Section (Reduced for Menu View) */}
                <View style={[styles.profileSection, { flexDirection: 'row', marginBottom: 32 }]}>
                    <View style={styles.avatarContainer}>
                        <Image
                            source={user?.avatarUrl ? { uri: user.avatarUrl } : require('../../assets/user.png')}
                            style={[styles.avatar, { width: 80, height: 80, borderRadius: 40 }]}
                        />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { fontSize: 18 }]}>
                            {user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
                        </Text>
                        {user?.email && (
                            <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{user.email}</Text>
                        )}
                    </View>
                </View>

                {/* Menu Group 1 */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder]}
                        onPress={() => setSubScreen('editProfile')} // Open Edit Profile
                    >
                        <View style={styles.menuIcon}>
                            <AccountIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Cuenta</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder]}
                        onPress={() => setSubScreen('privacy')} // Open Privacy Screen
                    >
                        <View style={styles.menuIcon}>
                            <PrivacyIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Privacidad</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => onNavigate('chats')}
                    >
                        <View style={styles.menuIcon}>
                            <ChatIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Chats</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                </View>

                {/* Emergency Contacts */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => setSubScreen('emergencyContacts')}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#FFE5E5' }]}>
                            <EmergencyContactIcon size={18} color="#FF3B30" />
                        </View>
                        <Text style={styles.menuLabel}>Contactos de Emergencia</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                </View>

                {/* Menu Group 2 */}
                <View style={styles.menuGroup}>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder]}
                        onPress={() => Linking.openURL('https://tincadia-frontend.vercel.app/contacto')}
                    >
                        <Text style={[styles.menuLabel, { marginLeft: 0 }]}>Ayuda</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder]}
                        onPress={handleInviteFriends}
                    >
                        <View style={styles.menuIcon}>
                            <InviteIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Invitar amigos</Text>
                        <ChevronRightIcon size={20} color="#999999" />
                    </TouchableOpacity>

                    {/* Test Notification Button */}
                    <TouchableOpacity style={styles.menuItem} onPress={handleTestPush}>
                        <Text style={[styles.menuLabel, { marginLeft: 0, color: '#007AFF' }]}>
                            Probar Notificación Push
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

// Add styles locally if needed or modify StyleSheet
// For now I'll assume profileScreenStyles has basic containers, but I'll add field styles to style file if possible or Inline them for speed if simple.
// I will check the imported styles first. The styles file contains header, etc.
// I'll add the new field styles to the style file in the next step or right here if I'm not using the imported ones exclusively.
// Actually, to avoid breaking, I should update the style file too or add inline styles.
// Given the tool usage, I'll update the style file first or AFTER this?
// I'll use inline styles for the new specific layout parts to ensure it works immediately without context switching back and forth too much, or better:
// I'll assume standard flex styles.


