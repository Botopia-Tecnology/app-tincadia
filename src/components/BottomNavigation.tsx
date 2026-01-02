import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TouchableWithoutFeedback, Alert } from 'react-native';
import { bottomNavigationStyles as styles } from '../styles/BottomNavigation.styles';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
} from './icons/NavigationIcons';
import { useTranslation } from '../hooks/useTranslation';
import { QRScannerScreen } from './QRScannerScreen';

interface BottomNavigationProps {
    currentScreen: 'chats' | 'courses' | 'sos' | 'profile';
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleMenuOption = (option: string) => {
        console.log(`Selected option: ${option}`);
        closeMenu();
        if (option === 'qr') {
            setShowScanner(true);
        } else if (option === 'tincards') {
            // Handle Tincards navigation
            Alert.alert('Tincards', 'Próximamente');
        }
    };

    const handleScanResult = (data: string) => {
        setShowScanner(false);
        // Handle the scanned data here
        setTimeout(() => {
            Alert.alert('Código QR Detectado', data);
        }, 500);
    };

    if (showScanner) {
        return (
            <Modal animationType="slide" visible={true} onRequestClose={() => setShowScanner(false)}>
                <QRScannerScreen
                    onClose={() => setShowScanner(false)}
                    onScan={handleScanResult}
                />
            </Modal>
        );
    }

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
                    <View style={styles.menuOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.floatingMenuContainer}>
                                <TouchableOpacity style={styles.floatingMenuItem} onPress={() => handleMenuOption('tincards')}>
                                    <View style={styles.floatingLabelContainer}>
                                        <Text style={styles.floatingLabel}>Tincards</Text>
                                    </View>
                                    <View style={[styles.floatingButton, { backgroundColor: '#4A90E2' }]}>
                                        {/* Use a placeholder text or icon for now */}
                                        <Text style={styles.floatingButtonText}>T</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.floatingMenuItem} onPress={() => handleMenuOption('qr')}>
                                    <View style={styles.floatingLabelContainer}>
                                        <Text style={styles.floatingLabel}>Lector QR</Text>
                                    </View>
                                    <View style={[styles.floatingButton, { backgroundColor: '#333' }]}>
                                        <Text style={styles.floatingButtonText}>QR</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Bottom Navigation Bar */}
            <View style={styles.bottomContainer}>
                <View style={styles.bottomNav}>
                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'chats' && styles.navItemActive]}
                        onPress={() => onNavigate('chats')}
                    >
                        <ChatIcon size={24} color={currentScreen === 'chats' ? '#000000' : '#666666'} />
                        <Text style={[styles.navLabel, currentScreen === 'chats' && styles.navLabelActive]}>
                            {t('navigation.chats')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'courses' && styles.navItemActive]}
                        onPress={() => onNavigate('courses')}
                    >
                        <CoursesIcon size={24} color={currentScreen === 'courses' ? '#000000' : '#666666'} />
                        <Text style={[styles.navLabel, currentScreen === 'courses' && styles.navLabelActive]}>
                            {t('navigation.courses')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleMenu} style={styles.tincadiaIconContainer}>
                        <Image source={require('../../assets/icon.png')} style={styles.tincadiaIcon} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'sos' && styles.navItemActive]}
                        onPress={() => onNavigate('sos')}
                    >
                        <SOSIcon size={32} color={currentScreen === 'sos' ? '#000000' : '#666666'} />
                        <Text style={[styles.navLabel, currentScreen === 'sos' && styles.navLabelActive]}>
                            {t('navigation.sos')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.navItem, currentScreen === 'profile' && styles.navItemActive]}
                        onPress={() => onNavigate('profile')}
                    >
                        <ProfileIcon size={24} color={currentScreen === 'profile' ? '#000000' : '#666666'} />
                        <Text style={[styles.navLabel, currentScreen === 'profile' && styles.navLabelActive]}>
                            {t('navigation.profile')}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </>
    );
}
