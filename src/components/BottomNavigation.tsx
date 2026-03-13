import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TouchableWithoutFeedback, Alert, ActivityIndicator } from 'react-native';
import { bottomNavigationStyles as styles } from '../styles/BottomNavigation.styles';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
} from './icons/NavigationIcons';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { chatService } from '../services/chat.service';
import { useSubscription } from '../hooks/useSubscription';
import { UpgradeModal } from './UpgradeModal';
import { Video } from 'lucide-react-native';

interface BottomNavigationProps {
    currentScreen: 'chats' | 'courses' | 'sos' | 'profile';
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile' | 'call', params?: any) => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { colors } = useTheme();
    const { isPremium } = useSubscription(user?.id);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isRequestingInterpreter, setIsRequestingInterpreter] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleInterpreterCall = async () => {
        if (!user) {
            Alert.alert('Inicia sesión', 'Necesitamos tu usuario para contactar a un intérprete.');
            return;
        }

        // Only premium users can request interpreters
        if (!isPremium) {
            closeMenu();
            setShowUpgradeModal(true);
            return;
        }

        const username = user?.firstName || user?.email || 'Usuario';
        const userId = user.id;
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

            closeMenu();
            onNavigate('call', { roomName, username, userId });
        } catch (error) {
            console.error('Error solicitando intérprete:', error);
            Alert.alert('Error', 'No pudimos contactar a un intérprete. Intenta de nuevo.');
        } finally {
            setIsRequestingInterpreter(false);
        }
    };

    return (
        <>
            {/* Floating Menu Modal */}
            <Modal
                visible={isMenuOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={closeMenu}
            >
                <TouchableWithoutFeedback onPress={closeMenu}>
                    <View style={[styles.menuOverlay, { backgroundColor: colors.overlay }]}>
                        <TouchableWithoutFeedback>
                            <View style={styles.floatingMenuContainer}>
                                <TouchableOpacity
                                    style={styles.floatingMenuItem}
                                    onPress={handleInterpreterCall}
                                    disabled={isRequestingInterpreter}
                                >
                                    <View style={[styles.floatingLabelContainer, { backgroundColor: colors.card }]}>
                                        <Text style={[styles.floatingLabel, { color: colors.text }]}>Intérprete</Text>
                                    </View>
                                    <View style={[styles.floatingButton, { backgroundColor: '#4A90E2' }]}>
                                        {isRequestingInterpreter ? (
                                            <ActivityIndicator color="white" size="small" />
                                        ) : (
                                            <Video size={24} color="white" />
                                        )}
                                    </View>
                                </TouchableOpacity>

                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Bottom Navigation Bar */}
            <View style={styles.bottomContainer}>
                <View style={[styles.bottomNav, { backgroundColor: colors.navBar }]}>
                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'chats' && [styles.navItemActive, { backgroundColor: colors.navBarActive }]]}
                        onPress={() => onNavigate('chats')}
                    >
                        <ChatIcon size={24} color={currentScreen === 'chats' ? colors.text : colors.iconSecondary} />
                        <Text style={[styles.navLabel, { color: colors.textMuted }, currentScreen === 'chats' && [styles.navLabelActive, { color: colors.text }]]}>
                            {t('navigation.chats')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'courses' && [styles.navItemActive, { backgroundColor: colors.navBarActive }]]}
                        onPress={() => onNavigate('courses')}
                    >
                        <CoursesIcon size={24} color={currentScreen === 'courses' ? colors.text : colors.iconSecondary} />
                        <Text style={[styles.navLabel, { color: colors.textMuted }, currentScreen === 'courses' && [styles.navLabelActive, { color: colors.text }]]}>
                            {t('navigation.courses')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleMenu} style={styles.tincadiaIconContainer}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={[styles.tincadiaIcon, { tintColor: colors.text }]}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'sos' && [styles.navItemActive, { backgroundColor: colors.navBarActive }]]}
                        onPress={() => onNavigate('sos')}
                    >
                        <SOSIcon size={32} color={currentScreen === 'sos' ? colors.text : colors.iconSecondary} />
                        <Text style={[styles.navLabel, { color: colors.textMuted }, currentScreen === 'sos' && [styles.navLabelActive, { color: colors.text }]]}>
                            {t('navigation.sos')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'profile' && [styles.navItemActive, { backgroundColor: colors.navBarActive }]]}
                        onPress={() => onNavigate('profile')}
                    >
                        <ProfileIcon size={24} color={currentScreen === 'profile' ? colors.text : colors.iconSecondary} />
                        <Text style={[styles.navLabel, { color: colors.textMuted }, currentScreen === 'profile' && [styles.navLabelActive, { color: colors.text }]]}>
                            {t('navigation.profile')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="interpreter"
            />
        </>
    );
}
