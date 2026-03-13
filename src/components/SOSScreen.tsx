import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, ActivityIndicator, Animated, Alert, TextInput } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { emergencyService } from '../services/emergency.service';
import { emergencyContactsStorage, EmergencyContact } from '../services/emergencyContacts.storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { sosScreenStyles as styles } from '../styles/SOSScreen.styles';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatService } from '../services/chat.service';
import {
    Siren,
    Ambulance,
    Flame,
    AlertTriangle,
    MapPin,
    Info,
    Play,
    Square,
    ChevronLeft,
    MessageCircle,
    Pause,
    Search,
    Video
} from 'lucide-react-native';
import { SearchIcon } from './icons/NavigationIcons';

interface EmergencyType {
    id: string;
    icon: any;
    color: string;
    label: string;
}

interface SOSScreenProps {
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call', params?: { roomName?: string; username?: string; conversationId?: string; userId?: string }) => void;
    onBack: () => void;
    userId?: string;
    onShowNotifications?: () => void;
}

// Global audio instance to persist across navigation
let globalSound: Audio.Sound | null = null;

export function SOSScreen({
    onNavigate,
    onBack,
    userId,
    onShowNotifications,
}: SOSScreenProps) {
    const { user } = useAuth();
    const { colors, isDark } = useTheme();

    const emergencyTypes: EmergencyType[] = [
        { id: '1', icon: Flame, color: '#EF4444', label: 'BOMBEROS' },
        { id: '2', icon: Ambulance, color: '#3B82F6', label: 'AMBULANCIA' },
        { id: '3', icon: Siren, color: '#10B981', label: 'POLICÍA' },
        { id: '4', icon: AlertTriangle, color: '#F59E0B', label: 'OTRA' },
    ];

    const [activeEmergency, setActiveEmergency] = useState<EmergencyType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
    const [isRequestingInterpreter, setIsRequestingInterpreter] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Load emergency contacts on mount
    useEffect(() => {
        const loadContacts = async () => {
            const contacts = await emergencyContactsStorage.getContacts();
            setEmergencyContacts(contacts);
        };
        loadContacts();
    }, []);

    // Configure audio mode on mount
    useEffect(() => {
        const configureAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: true,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: true,
                    interruptionModeIOS: 1,
                    interruptionModeAndroid: 1,
                });
            } catch (e) {
                console.error('Error configuring audio mode', e);
            }
        };
        configureAudio();
    }, []);

    // Get location on mount
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc);

            try {
                let reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                if (reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    setAddress(`${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}`);
                }
            } catch (e) {
                console.log("Reverse geocode failed", e);
            }
        })();
    }, []);

    // Auto-play effect when URL is ready
    useEffect(() => {
        if (audioUrl) {
            playAudio(audioUrl);
        }
    }, [audioUrl]);

    const playAudio = async (url: string) => {
        try {
            // Stop existing if any
            if (globalSound) {
                await globalSound.unloadAsync();
                globalSound = null;
            }

            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: true }
            );
            globalSound = sound;
            setIsPlaying(true);

            sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                    // Reset position for replay
                    sound.setPositionAsync(0);
                }
            });
        } catch (error) {
            console.error('Playback failed', error);
        }
    };

    const togglePlayback = async () => {
        if (!globalSound) {
            if (audioUrl) playAudio(audioUrl);
            return;
        }

        if (isPlaying) {
            await globalSound.pauseAsync();
            setIsPlaying(false);
        } else {
            await globalSound.playAsync();
            setIsPlaying(true);
        }
    };

    const handleEmergencyPress = async (type: EmergencyType) => {
        setActiveEmergency(type);
        setAudioUrl(null);

        // Stop previous audio
        if (globalSound) {
            await globalSound.unloadAsync();
            globalSound = null;
            setIsPlaying(false);
        }

        const emergencyNumber = process.env.EXPO_PUBLIC_EMERGENCY_NUMBER || '123';

        // Build emergency message with location
        const lat = location?.coords.latitude.toFixed(6) || 'Desconocida';
        const lon = location?.coords.longitude.toFixed(6) || 'Desconocida';
        const locationText = address ? address : `Lat: ${lat}, Lon: ${lon}`;
        const googleMapsLink = location
            ? `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`
            : '';

        const emergencyMessage = `🆘 EMERGENCIA - SOY PERSONA SORDA\n\nTipo: ${typeToText(type.label).toUpperCase()}\nUbicación: ${locationText}\n${googleMapsLink ? `Mapa: ${googleMapsLink}` : ''}\n\nNecesito ayuda urgente. No puedo hablar por teléfono.`;

        // 1. Send SMS first
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
            try {
                await SMS.sendSMSAsync([emergencyNumber], emergencyMessage);
            } catch (smsError) {
                console.log('SMS send error (user may have cancelled):', smsError);
            }
        }

        // 2. Then make the call
        Linking.openURL(`tel:${emergencyNumber}`);

        // 3. Generate audio in background (for manual playback if needed)
        generateAudioForType(type);
    };

    const generateAudioForType = async (type: EmergencyType) => {
        setIsLoading(true);
        try {
            const lat = location?.coords.latitude.toFixed(5) || 'Desconocida';
            const lon = location?.coords.longitude.toFixed(5) || 'Desconocida';
            const locationText = address ? `cerca de ${address}` : `Coordenadas: latitud ${lat}, longitud ${lon}`;

            const { url } = await emergencyService.generateAudio(typeToText(type.label), locationText);
            setAudioUrl(url);
        } catch (error) {
            console.error('Error generating audio:', error);
            Alert.alert('Error', 'No se pudo generar el audio de emergencia. Por favor intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const typeToText = (label: string) => {
        switch (label) {
            case 'BOMBEROS': return 'incendio o rescate';
            case 'AMBULANCIA': return 'asistencia médica urgente';
            case 'POLICÍA': return 'seguridad policial';
            default: return 'emergencia general';
        }
    };

    const sendWhatsAppEmergency = async () => {
        // Check if user has stored emergency contacts
        if (emergencyContacts.length === 0) {
            Alert.alert(
                'Sin contactos de emergencia',
                'Agrega contactos de emergencia en tu perfil para enviar alertas por WhatsApp.',
                [{ text: 'OK' }]
            );
            return;
        }

        const lat = location?.coords.latitude.toFixed(6) || 'Desconocida';
        const lon = location?.coords.longitude.toFixed(6) || 'Desconocida';
        const locationText = address || `Lat: ${lat}, Lon: ${lon}`;
        const googleMapsLink = location
            ? `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`
            : '';

        const emergencyType = activeEmergency ? typeToText(activeEmergency.label).toUpperCase() : 'GENERAL';

        const message = `🆘 *EMERGENCIA - SOY PERSONA SORDA*\n\n*Tipo:* ${emergencyType}\n*Ubicación:* ${locationText}\n${googleMapsLink ? `*Mapa:* ${googleMapsLink}` : ''}\n\nNecesito ayuda urgente. No puedo hablar por teléfono.`;

        // Send to all emergency contacts
        for (const contact of emergencyContacts) {
            const formattedNumber = contact.phone.replace(/[^\d+]/g, '');
            const whatsappUrl = `whatsapp://send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;

            try {
                const canOpen = await Linking.canOpenURL(whatsappUrl);
                if (canOpen) {
                    await Linking.openURL(whatsappUrl);
                    return; // Open one at a time, user can tap button again for next contact
                }
            } catch (error) {
                console.error('Error opening WhatsApp for', contact.name, error);
            }
        }

        Alert.alert('WhatsApp no disponible', 'Por favor instala WhatsApp para usar esta función.');
    };

    const handleInterpreterEmergencyCall = async () => {
        if (!userId) {
            Alert.alert('Inicia sesión', 'Necesitamos tu usuario para contactar a un intérprete.');
            return;
        }

        const username = user?.firstName || user?.email || 'Usuario';
        const roomName = `sos-${userId}-${Date.now()}`;

        setIsRequestingInterpreter(true);
        try {
            const result = await chatService.inviteInterpreters({
                roomName,
                userId,
                username,
            });

            if (result?.success) {
                Alert.alert('Solicitud enviada', `Se notificó a ${result.count || 1} intérprete(s).`);
            } else if (result?.message) {
                Alert.alert('Aviso', result.message);
            }

            onNavigate('call', { roomName, username, userId });
        } catch (error) {
            console.error('Error solicitando intérprete SOS:', error);
            Alert.alert('Error', 'No pudimos contactar a un intérprete. Intenta de nuevo.');
        } finally {
            setIsRequestingInterpreter(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <View style={styles.headerTop}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Centro de Ayuda</Text>
                    {userId && onShowNotifications ? (
                        <NotificationBell
                            userId={userId}
                            onPress={onShowNotifications}
                            color={colors.icon}
                        />
                    ) : (
                        <View style={styles.notificationButton} />
                    )}
                </View>

                {/* Decorative Search Bar */}
                <View style={[styles.searchContainer, { backgroundColor: colors.inputBg }]}>
                    <SearchIcon size={20} color={colors.textMuted} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Buscar ayuda"
                        placeholderTextColor={colors.textMuted}
                        editable={false}
                    />
                </View>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

                {/* Status Card / Instructions */}
                <View style={[styles.statusCard, {
                    backgroundColor: isDark ? '#1A2744' : '#EFF6FF',
                    borderColor: isDark ? '#2A3F6B' : '#DBEAFE',
                }]}>
                    <View style={styles.statusHeader}>
                        <Info size={20} color="#3B82F6" />
                        <Text style={[styles.statusTitle, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>¿Cómo funciona?</Text>
                    </View>
                    <Text style={[styles.statusText, { color: isDark ? '#93C5FD' : '#3B82F6' }]}>
                        1. Presiona una opción para llamar al 123.
                    </Text>
                    <Text style={[styles.statusText, { color: isDark ? '#93C5FD' : '#3B82F6' }]}>
                        2. Activa el altavoz de tu teléfono.
                    </Text>
                    <Text style={[styles.statusText, { color: isDark ? '#93C5FD' : '#3B82F6' }]}>
                        3. El audio con tu ubicación se reproducirá automáticamente para el operador.
                    </Text>
                </View>

                {/* Active Emergency State */}
                {activeEmergency && (
                    <View style={[styles.activeStateCard, {
                        backgroundColor: colors.card,
                        borderColor: activeEmergency.color,
                    }]}>
                        <View style={styles.activeHeader}>
                            <activeEmergency.icon size={24} color={activeEmergency.color} />
                            <Text style={[styles.activeTitle, { color: activeEmergency.color }]}>
                                {activeEmergency.label} EN CURSO
                            </Text>
                        </View>

                        <View style={styles.audioControls}>
                            {isLoading ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color={activeEmergency.color} />
                                    <Text style={[styles.loadingText, { color: colors.textMuted }]}>Generando voz de auxilio...</Text>
                                </View>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.playButton, { backgroundColor: activeEmergency.color }]}
                                        onPress={togglePlayback}
                                    >
                                        {isPlaying ? (
                                            <Pause size={24} color="white" fill="white" />
                                        ) : (
                                            <Play size={24} color="white" fill="white" />
                                        )}
                                        <Text style={styles.playButtonText}>
                                            {isPlaying ? 'PAUSAR' : 'REPRODUCIR'}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.playButton, { backgroundColor: '#25D366', marginTop: 12 }]}
                                        onPress={sendWhatsAppEmergency}
                                    >
                                        <MessageCircle size={24} color="white" />
                                        <Text style={styles.playButtonText}>
                                            ENVIAR WHATSAPP
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                        <Text style={[styles.activeHint, { color: colors.textMuted }]}>
                            El operador escuchará esto: "Soy una persona sorda, necesito ayuda..."
                        </Text>
                    </View>
                )}

                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Selecciona el tipo de emergencia</Text>

                {/* Grid */}
                <View style={styles.gridContainer}>
                    {emergencyTypes.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.gridItem, {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                            }]}
                            onPress={() => handleEmergencyPress(item)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: `${item.color}15` }]}>
                                <item.icon size={32} color={item.color} />
                            </View>
                            <Text style={[styles.gridLabel, { color: colors.text }]}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Interpreter urgent call */}
                <View style={[styles.interpreterCard, {
                    backgroundColor: isDark ? '#1A1F3A' : '#EEF2FF',
                    borderColor: isDark ? '#2D3566' : '#C7D2FE',
                }]}>
                    <View style={styles.interpreterHeader}>
                        <Video size={24} color={isDark ? '#818CF8' : '#1E3A8A'} />
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.interpreterTitle, { color: isDark ? '#818CF8' : '#1E3A8A' }]}>Videollamada urgente con intérprete</Text>
                            <Text style={[styles.interpreterSubtitle, { color: isDark ? '#818CF8' : '#1E3A8A' }]}>
                                Conecta ya con un intérprete para comunicarte con emergencias.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.interpreterButton, { backgroundColor: isDark ? '#4F46E5' : '#1E40AF' }]}
                        onPress={handleInterpreterEmergencyCall}
                        disabled={isRequestingInterpreter}
                    >
                        {isRequestingInterpreter ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.interpreterButtonText}>Llamar a intérprete</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Location Footer */}
                <View style={styles.locationFooter}>
                    <MapPin size={18} color={colors.textMuted} />
                    <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                        {address || "Ubicación actual detectada"}
                    </Text>
                </View>

            </ScrollView>

            <BottomNavigation currentScreen="sos" onNavigate={onNavigate} />
        </SafeAreaView>
    );
}
