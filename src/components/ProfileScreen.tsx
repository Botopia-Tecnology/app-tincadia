import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { profileScreenStyles as styles } from '../styles/ProfileScreen.styles';
import { useAuth } from '../contexts/AuthContext';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
    BackArrowIcon,
    NotificationIcon,
    SearchIcon,
    AccountIcon,
    PrivacyIcon,
    HelpIcon,
    InviteIcon,
    ChevronRightIcon,
} from './icons/NavigationIcons';
import { BottomNavigation } from './BottomNavigation';

export function ProfileScreen({ onNavigate }: { onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void }) {
    const { user, logout, isLoading } = useAuth();

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
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('chats')}>
                    <BackArrowIcon size={32} color="#000000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Perfil</Text>
                <TouchableOpacity style={styles.notificationButton}>
                    <NotificationIcon size={24} color="#000000" />
                </TouchableOpacity>
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
                    <View style={styles.avatarContainer}>
                        <Image
                            source={require('../../assets/user.png')}
                            style={styles.avatar}
                        />
                        <View style={styles.badgeIcon}>
                            <AccountIcon size={16} color="#666666" />
                        </View>
                    </View>
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
                    <TouchableOpacity style={styles.menuItem}>
                        <View style={styles.menuIcon}>
                            <InviteIcon size={20} color="#666666" />
                        </View>
                        <Text style={styles.menuLabel}>Invitar amigos</Text>
                        <ChevronRightIcon size={20} color="#999999" />
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
        </SafeAreaView>
    );
}

