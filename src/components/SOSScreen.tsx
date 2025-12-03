import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { sosScreenStyles as styles } from '../styles/SOSScreen.styles';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
    HandshakeIcon,
} from './icons/NavigationIcons';

interface EmergencyType {
    id: string;
    icon: string;
    label: string;
}

export function SOSScreen({ onNavigate }: { onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void }) {
    const emergencyTypes: EmergencyType[] = [
        { id: '1', icon: '🔥', label: 'BOMBEROS' },
        { id: '2', icon: '🚑', label: 'AMBULANCIA' },
        { id: '3', icon: '👮', label: 'POLICÍA' },
        { id: '4', icon: '🚨', label: 'OTRA EMERGENCIA' },
    ];

    const handleEmergencyPress = (type: EmergencyType) => {
        // TODO: Implementar lógica de envío de emergencia
        console.log('Emergency pressed:', type.label);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => onNavigate('chats')}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SOS</Text>
                <TouchableOpacity style={styles.notificationButton}>
                    <Text style={styles.notificationIcon}>🔔</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
                {/* Description */}
                <View style={styles.descriptionContainer}>
                    <Text style={styles.descriptionText}>
                        Selecciona el tipo de ayuda. Tu ubicación se enviará automáticamente
                    </Text>
                    <View style={styles.userTagContainer}>
                        <Text style={styles.userTagText}>Usuario sordo / dificultad de habla</Text>
                    </View>
                </View>

                {/* Emergency Buttons Grid */}
                <View style={styles.emergencyGrid}>
                    {emergencyTypes.map((emergency) => (
                        <TouchableOpacity
                            key={emergency.id}
                            style={styles.emergencyButton}
                            onPress={() => handleEmergencyPress(emergency)}
                        >
                            <View style={styles.emergencyIconContainer}>
                                <Text style={styles.emergencyIcon}>{emergency.icon}</Text>
                            </View>
                            <Text style={styles.emergencyLabel}>{emergency.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Location Info */}
                <View style={styles.locationInfo}>
                    <Text style={styles.locationIcon}>📍</Text>
                    <View style={styles.locationTextContainer}>
                        <Text style={styles.locationText}>
                            Usaremos tu ubicación actual para enviar la ayuda
                        </Text>
                        <TouchableOpacity>
                            <Text style={styles.emergencyInfoLink}>Ver mi información de emergencia</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomContainer}>
                <View style={styles.bottomNav}>
                    <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('chats')}>
                        <ChatIcon size={24} color="#000000" />
                        <Text style={styles.navLabel}>Chats</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('courses')}>
                        <CoursesIcon size={24} color="#000000" />
                        <Text style={styles.navLabel}>Cursos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.navItem, styles.navItemActive]} onPress={() => onNavigate('sos')}>
                        <SOSIcon size={32} color="#000000" />
                        <Text style={[styles.navLabel, styles.navLabelActive]}>SOS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.navItem} onPress={() => onNavigate('profile')}>
                        <ProfileIcon size={24} color="#000000" />
                        <Text style={styles.navLabel}>Perfil</Text>
                    </TouchableOpacity>
                </View>
                <Image source={require('../../assets/icon.png')} style={styles.tincadiaIcon} />
            </View>
        </SafeAreaView>
    );
}
