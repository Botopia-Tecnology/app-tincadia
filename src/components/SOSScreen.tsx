import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, ActivityIndicator, Animated, Alert, TextInput } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import * as Clipboard from 'expo-clipboard';
import { emergencyService } from '../services/emergency.service';
import { KeyboardSafeView } from './common/KeyboardSafeView';
import { StatusBar } from 'expo-status-bar';
import { sosScreenStyles as styles } from '../styles/SOSScreen.styles';
import { BottomNavigation } from './BottomNavigation';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from './UpgradeModal';
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
import { NavigateFunction } from '../types/navigation.types';

interface EmergencyType {
    id: string;
    icon: React.ElementType;
    color: string;
    label: string;
    /** Línea telefónica de emergencia (Colombia) */
    phone: string;
}

interface SOSScreenProps {
    onNavigate: NavigateFunction;
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
    const { canUseInterpreter } = useSubscription(userId);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const emergencyTypes: EmergencyType[] = [
        { id: 'policia', icon: Siren, color: '#10B981', label: 'POLICÍA NACIONAL', phone: '112' },
        { id: 'bomberos', icon: Flame, color: '#EF4444', label: 'BOMBEROS', phone: '119' },
        { id: 'ambulancia', icon: Ambulance, color: '#3B82F6', label: 'AMBULANCIA', phone: '125' },
        { id: 'otra', icon: AlertTriangle, color: '#F59E0B', label: 'OTRA', phone: '123' },
    ];

    const [activeEmergency, setActiveEmergency] = useState<EmergencyType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isRequestingInterpreter, setIsRequestingInterpreter] = useState(false);

    const pulseAnim = useRef(new Animated.Value(1)).current;

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

            let loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
            });
            setLocation(loc);

            const lat = loc.coords.latitude;
            const lon = loc.coords.longitude;

            // 1. Intentar con Expo (nativo)
            let resolved = false;
            try {
                let reverseGeocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
                if (reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    const parts = [
                        addr.street
                            ? `${addr.street}${addr.streetNumber ? ' ' + addr.streetNumber : ''}`
                            : (addr.district || addr.name || null),
                        addr.city || addr.subregion || addr.region || null,
                    ].filter(Boolean);
                    if (parts.length > 0 && parts.some(p => (p as string).trim().length > 0)) {
                        setAddress(parts.join(', '));
                        resolved = true;
                    }
                }
            } catch (e) {
                console.log("Expo reverse geocode failed", e);
            }

            // 2. Fallback: Nominatim (OpenStreetMap) — gratis, sin API key
            if (!resolved) {
                try {
                    const resp = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=es`,
                        { headers: { 'User-Agent': 'TincadiaApp/1.0' } }
                    );
                    const data = await resp.json();
                    if (data?.address) {
                        const a = data.address;
                        const parts = [
                            a.road || a.pedestrian || a.neighbourhood || null,
                            a.house_number || null,
                            a.suburb || a.city_district || null,
                            a.city || a.town || a.village || a.state || null,
                        ].filter(Boolean);
                        if (parts.length > 0) {
                            setAddress(parts.join(', '));
                            resolved = true;
                        }
                    }
                } catch (e) {
                    console.log("Nominatim reverse geocode failed", e);
                }
            }

            // 3. Último fallback: coordenadas legibles
            if (!resolved) {
                setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
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

        const emergencyNumber = type.phone;

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
            case 'POLICÍA NACIONAL':
            case 'POLICÍA': return 'seguridad policial';
            default: return 'emergencia general';
        }
    };

    const buildEmergencyWhatsAppMessage = (): string => {
        const lat = location?.coords.latitude.toFixed(6) || 'Desconocida';
        const lon = location?.coords.longitude.toFixed(6) || 'Desconocida';
        const locationText = address || `Lat: ${lat}, Lon: ${lon}`;
        const googleMapsLink = location
            ? `https://maps.google.com/?q=${location.coords.latitude},${location.coords.longitude}`
            : '';

        const typeLine = activeEmergency
            ? typeToText(activeEmergency.label).toUpperCase()
            : 'EMERGENCIA GENERAL';

        return [
            '*EMERGENCIA – PERSONA SORDA*',
            '',
            'Solicito ayuda *urgente*. No puedo hablar por teléfono.',
            '',
            `*Tipo:* ${typeLine}`,
            `*Ubicación:* ${locationText}`,
            googleMapsLink ? `*Mapa:* ${googleMapsLink}` : '',
            '',
            '_Mensaje generado desde la app Tincadia._',
        ]
            .filter(Boolean)
            .join('\n');
    };

    /**
     * Abre WhatsApp *sin* fijar un número: el usuario elige el contacto o grupo.
     * WhatsApp no permite elegir varios destinatarios en un solo paso; el texto se
     * copia al portapapeles para poder pegarlo en otros chats después de enviar.
     */
    const sendWhatsAppEmergency = async () => {
        const message = buildEmergencyWhatsAppMessage();
        const encoded = encodeURIComponent(message);

        try {
            await Clipboard.setStringAsync(message);
        } catch (e) {
            console.warn('Clipboard copy failed', e);
        }

        const waApp = `whatsapp://send?text=${encoded}`;
        const waWeb = `https://api.whatsapp.com/send?text=${encoded}`;

        try {
            const canOpenApp = await Linking.canOpenURL(waApp);
            if (canOpenApp) {
                await Linking.openURL(waApp);
                return;
            }
        } catch {
            /* app scheme not available */
        }

        try {
            await Linking.openURL(waWeb);
        } catch {
            Alert.alert(
                'WhatsApp no disponible',
                'El mensaje quedó copiado en tu portapapeles. Abre WhatsApp y pégalo en los chats que necesites.'
            );
        }
    };

    const handleInterpreterEmergencyCall = async () => {
        if (!userId) {
            Alert.alert('Inicia sesión', 'Necesitamos tu usuario para contactar a un intérprete.');
            return;
        }

        if (!canUseInterpreter) {
            setShowUpgradeModal(true);
            return;
        }

        const rawUsername = user?.firstName || user?.email || 'Usuario';
        const username = user?.role === 'interpreter' ? `Intérprete: ${rawUsername}` : rawUsername;
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
        <KeyboardSafeView style={[styles.container, { backgroundColor: colors.background }]} dismissOnPress={false}>
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

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>

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
                        1. Elige el tipo: cada botón marca su línea (Policía 112, Bomberos 119, Ambulancia 125, otras 123).
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
                                            WHATSAPP
                                        </Text>
                                    </TouchableOpacity>
                                    <Text style={[styles.activeHint, { color: colors.textMuted, marginTop: 10, fontSize: 12, lineHeight: 17 }]}>
                                        Se abre WhatsApp para que elijas el contacto o grupo. El mensaje también se copia: después de enviar, puedes pegarlo en otros chats.
                                    </Text>
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
                            <Text style={[styles.gridPhone, { color: colors.textMuted }]}>Línea {item.phone}</Text>
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

                {/* Disclaimer */}
                <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24, marginTop: 8, lineHeight: 16 }}>
                    Esta funcionalidad es una herramienta de asistencia comunicativa y no sustituye los servicios oficiales de emergencia. Al usarla, aceptas los{' '}
                    <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL('https://www.tincadia.com/terminos')}>términos y condiciones</Text>.
                </Text>

            </ScrollView>

            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="interpreter"
            />

            <BottomNavigation currentScreen="sos" onNavigate={onNavigate} />
        </KeyboardSafeView>
    );
}
