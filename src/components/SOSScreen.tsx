import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { sosScreenStyles as styles } from '../styles/SOSScreen.styles';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';

interface EmergencyType {
    id: string;
    image: any;
    label: string;
}

interface SOSScreenProps {
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
    onBack: () => void;
    userId?: string;
    onShowNotifications?: () => void;
}

export function SOSScreen({
    onNavigate,
    onBack,
    userId,
    onShowNotifications,
}: SOSScreenProps) {
    const emergencyTypes: EmergencyType[] = [
        { id: '1', image: require('../../assets/fire_sos-section.png'), label: 'BOMBEROS' },
        { id: '2', image: require('../../assets/ambulance_sos-section.png'), label: 'AMBULANCIA' },
        { id: '3', image: require('../../assets/police_sos-section.png'), label: 'POLICÍA' },
        { id: '4', image: require('../../assets/emergency_sos-section.png'), label: 'OTRA EMERGENCIA' },
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
                <TouchableOpacity style={styles.backButton} onPress={onBack}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>SOS</Text>
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
                                <Image source={emergency.image} style={styles.emergencyIconImage} />
                            </View>
                            <Text style={styles.emergencyLabel}>{emergency.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Location Info */}
                <View style={styles.locationInfo}>
                    <Image source={require('../../assets/location_sos-section.png')} style={styles.locationIconImage} />
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

            <BottomNavigation currentScreen="sos" onNavigate={onNavigate} />
        </SafeAreaView>
    );
}
