import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, TextInput, ActivityIndicator, Linking, Share, Switch } from 'react-native';
import { Settings, Moon, Sun } from 'lucide-react-native';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { profileScreenStyles as styles } from '../styles/ProfileScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
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

import { EditProfileScreen } from './profile/EditProfileScreen';
import { PrivacyScreen } from './profile/PrivacyScreen';
import { EmergencyContactsScreen } from './profile/EmergencyContactsScreen';

interface ProfileScreenProps {
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call', params?: any) => void;
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
    const { subscriptionStatus, isPremium, isBasico } = useSubscription(userId);
    const alert = useAlert();
    const { colors, isDark, themeMode, setThemeMode, systemTheme } = useTheme();
    // Local state to manage sub-screen navigation
    const [subScreen, setSubScreen] = useState<'none' | 'editProfile' | 'privacy' | 'emergencyContacts'>('none');

    // Derive plan display label from subscription status
    const getPlanLabel = () => {
        if (!subscriptionStatus?.hasSubscription) return 'Plan Gratis';
        const planType = subscriptionStatus.planType || '';
        if (planType === 'personal_premium') return 'Plan Premium';
        if (planType === 'empresa_corporate') return 'Membresía Empresarial';
        if (planType === 'personal_free') return 'Plan Básico';
        return 'Plan Básico';
    };
    const planLabel = getPlanLabel();



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
        <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]} dismissOnPress={false}>
            <StatusBar style={colors.statusBar} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background }]}>
                <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface }]} onPress={onBack}>
                    <BackArrowIcon size={32} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Perfil</Text>
                {userId && onShowNotifications ? (
                    <NotificationBell
                        userId={userId}
                        onPress={onShowNotifications}
                        color={colors.text}
                    />
                ) : (
                    <View style={[styles.notificationButton, { backgroundColor: colors.card }]} />
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
                    <View style={[styles.userInfo, { marginLeft: 20 }]}>
                        <Text style={[styles.userName, { fontSize: 18, color: colors.text }]}>
                            {user ? `${user.firstName} ${user.lastName}` : 'Usuario'}
                        </Text>
                        {user?.email && (
                            <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>{user.email}</Text>
                        )}
                        {/* Plan Badge - Clickable */}
                        <TouchableOpacity
                            onPress={() => Linking.openURL('https://www.tincadia.com/pricing')}
                            activeOpacity={0.7}
                        >
                            <View style={{
                                marginTop: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 4,
                                backgroundColor: isPremium ? '#FFD700' : '#E5E7EB',
                                borderRadius: 12,
                                alignSelf: 'flex-start',
                                flexDirection: 'row',
                                alignItems: 'center'
                            }}>
                                <Text style={{
                                    color: isPremium ? '#000' : '#4B5563',
                                    fontSize: 12,
                                    fontWeight: '600',
                                    marginRight: 4
                                }}>
                                    {planLabel}
                                </Text>
                                <ChevronRightIcon size={12} color={isPremium ? '#000' : '#666'} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Menu Group 1 */}
                <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}
                        onPress={() => setSubScreen('editProfile')}
                    >
                        <View style={styles.menuIcon}>
                            <AccountIcon size={20} color={colors.icon} />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Cuenta</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}
                        onPress={() => setSubScreen('privacy')}
                    >
                        <View style={styles.menuIcon}>
                            <PrivacyIcon size={20} color={colors.icon} />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Privacidad</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}
                        onPress={() => onNavigate('chats')}
                    >
                        <View style={styles.menuIcon}>
                            <ChatIcon size={20} color={colors.icon} />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Chats</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>

                </View>

                {/* Visual Settings */}
                <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {/* System Theme Toggle */}
                    <View style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}>
                        <View style={styles.menuIcon}>
                            <Settings size={20} color={colors.icon} />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Usar tema del dispositivo</Text>
                        <Switch
                            value={themeMode === 'system'}
                            onValueChange={(value) => setThemeMode(value ? 'system' : (isDark ? 'dark' : 'light'))}
                            trackColor={{ false: '#E5E7EB', true: '#4CAF50' }}
                            thumbColor={'#FFFFFF'}
                        />
                    </View>
                    {themeMode === 'system' && (
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 56, marginBottom: 8, marginTop: -8 }}>
                            Detectado: {systemTheme || 'unknown'}
                        </Text>
                    )}

                    {/* Dark Mode Toggle */}
                    <View style={[styles.menuItem, { borderBottomColor: colors.divider, opacity: themeMode === 'system' ? 0.5 : 1 }]}>
                        <View style={styles.menuIcon}>
                            {isDark ? (
                                <Moon size={20} color={colors.icon} />
                            ) : (
                                <Sun size={20} color={colors.icon} />
                            )}
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Modo Oscuro</Text>
                        <Switch
                            value={isDark}
                            disabled={themeMode === 'system'}
                            onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                            trackColor={{ false: '#E5E7EB', true: '#4CAF50' }}
                            thumbColor={isDark ? '#FFFFFF' : '#F4F3F4'}
                        />
                    </View>
                </View>

                {/* Emergency Contacts */}
                <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => setSubScreen('emergencyContacts')}
                    >
                        <View style={[styles.menuIcon, { backgroundColor: '#FFE5E5' }]}>
                            <EmergencyContactIcon size={18} color="#FF3B30" />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Contactos de Emergencia</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Menu Group 2 */}
                <View style={[styles.menuGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}
                        onPress={async () => {
                            try {
                                const url = 'https://www.tincadia.com/contacto';
                                console.log('Opening Help URL:', url);
                                await Linking.openURL(url);
                            } catch (err) {
                                console.error('Failed to open help URL:', err);
                            }
                        }}
                    >
                        <Text style={[styles.menuLabel, { marginLeft: 0, color: colors.text }]}>Ayuda</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemBorder, { borderBottomColor: colors.divider }]}
                        onPress={handleInviteFriends}
                    >
                        <View style={styles.menuIcon}>
                            <InviteIcon size={20} color={colors.icon} />
                        </View>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>Invitar amigos</Text>
                        <ChevronRightIcon size={20} color={colors.iconSecondary} />
                    </TouchableOpacity>

                    {/* Become Interpreter Button */}
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => Linking.openURL('https://www.tincadia.com/ser-interprete')}
                    >
                        <Text style={[styles.menuLabel, { marginLeft: 0, color: '#007AFF' }]}>
                            Conviértete en intérprete
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


