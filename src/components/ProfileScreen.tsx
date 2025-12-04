import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { profileScreenStyles as styles } from '../styles/ProfileScreen.styles';
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
                            source={require('../../assets/user.png')} // Using a placeholder, ideally this should be a real user image
                            style={styles.avatar}
                        />
                        <View style={styles.badgeIcon}>
                            {/* Using a placeholder icon for the badge, maybe a scale or legal icon */}
                            <AccountIcon size={16} color="#666666" />
                        </View>
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>Ana Lucia Rodriguez Pala...</Text>
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
            </ScrollView>

            <BottomNavigation currentScreen="profile" onNavigate={onNavigate} />
        </SafeAreaView>
    );
}
