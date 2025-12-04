import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { bottomNavigationStyles as styles } from '../styles/BottomNavigation.styles';
import {
    ChatIcon,
    CoursesIcon,
    SOSIcon,
    ProfileIcon,
} from './icons/NavigationIcons';
import { useTranslation } from '../hooks/useTranslation';

interface BottomNavigationProps {
    currentScreen: 'chats' | 'courses' | 'sos' | 'profile';
    onNavigate: (screen: 'chats' | 'courses' | 'sos' | 'profile') => void;
}

export function BottomNavigation({ currentScreen, onNavigate }: BottomNavigationProps) {
    const { t } = useTranslation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const closeMenu = () => {
        setIsMenuOpen(false);
    };

    const handleMenuOption = (option: string) => {
        console.log(`Selected option: ${option}`);
        closeMenu();
        // Add logic for menu options here
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
                    <View style={styles.menuOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.floatingMenuContainer}>
                                <View style={styles.floatingMenuItem}>
                                    <Text style={styles.floatingLabel}>Opción 1</Text>
                                    <TouchableOpacity style={styles.floatingButton} onPress={() => handleMenuOption('Option 1')}>
                                        <Text style={styles.floatingButtonText}>1</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.floatingMenuItem}>
                                    <Text style={styles.floatingLabel}>Opción 2</Text>
                                    <TouchableOpacity style={styles.floatingButton} onPress={() => handleMenuOption('Option 2')}>
                                        <Text style={styles.floatingButtonText}>2</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.floatingMenuItem}>
                                    <Text style={styles.floatingLabel}>Opción 3</Text>
                                    <TouchableOpacity style={styles.floatingButton} onPress={() => handleMenuOption('Option 3')}>
                                        <Text style={styles.floatingButtonText}>3</Text>
                                    </TouchableOpacity>
                                </View>
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

                <TouchableOpacity onPress={toggleMenu} style={styles.tincadiaIconContainer}>
                    <Image source={require('../../assets/icon.png')} style={styles.tincadiaIcon} />
                </TouchableOpacity>
            </View>
        </>
    );
}
