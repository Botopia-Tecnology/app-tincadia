/**
 * Custom Alert System
 * 
 * Modern, beautiful alert dialogs to replace native Alert.alert()
 * Provides consistent UI across iOS and Android.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { customAlertStyles as styles } from '../../styles/CustomAlert.styles';

// ==================== ICONS ====================

function SuccessIcon({ size = 48, color = '#4CAF50' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
            <Polyline points="8,12 11,15 16,9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
    );
}

function ErrorIcon({ size = 48, color = '#FF3B30' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
            <Path d="M15 9L9 15M9 9l6 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}

function WarningIcon({ size = 48, color = '#FF9500' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 2L1 21h22L12 2z"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                fill="none"
            />
            <Path d="M12 9v4M12 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}

function InfoIcon({ size = 48, color = '#007AFF' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
            <Path d="M12 16v-4M12 8h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}

function ConfirmIcon({ size = 48, color = '#25D366' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
            <Path d="M12 8v4M12 16h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void | Promise<void>;
}

export interface AlertConfig {
    type?: AlertType;
    title: string;
    message?: string;
    buttons?: AlertButton[];
}

interface AlertContextType {
    show: (config: AlertConfig) => void;
    hide: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert(): AlertContextType {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
}


interface AlertProviderProps {
    children: ReactNode;
}

export function AlertProvider({ children }: AlertProviderProps) {
    const [visible, setVisible] = useState(false);
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(0.9));

    const show = useCallback((alertConfig: AlertConfig) => {
        setConfig(alertConfig);
        setVisible(true);
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 100,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, scaleAnim]);

    const hide = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 0.9,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setConfig(null);
        });
    }, [fadeAnim, scaleAnim]);

    const handleButtonPress = async (button: AlertButton) => {
        if (button.onPress) {
            await button.onPress();
        }
        hide();
    };

    const getIcon = () => {
        if (!config?.type) return null;

        const icons = {
            success: <SuccessIcon />,
            error: <ErrorIcon />,
            warning: <WarningIcon />,
            info: <InfoIcon />,
            confirm: <ConfirmIcon />,
        };

        return icons[config.type] || null;
    };

    const getButtonStyle = (button: AlertButton, index: number, total: number) => {
        const isLast = index === total - 1;

        if (button.style === 'destructive') {
            return [styles.button, styles.buttonDestructive];
        } else if (button.style === 'cancel') {
            return [styles.button, styles.buttonCancel];
        } else if (isLast && total > 1) {
            return [styles.button, styles.buttonPrimary];
        } else {
            return [styles.button, styles.buttonDefault];
        }
    };

    const getButtonTextStyle = (button: AlertButton, index: number, total: number) => {
        const isLast = index === total - 1;

        if (button.style === 'destructive') {
            return [styles.buttonText, styles.buttonTextDestructive];
        } else if (button.style === 'cancel') {
            return [styles.buttonText, styles.buttonTextCancel];
        } else if (isLast && total > 1) {
            return [styles.buttonText, styles.buttonTextPrimary];
        }

        return [styles.buttonText];
    };

    // Default buttons if none provided
    const buttons = config?.buttons || [{ text: 'OK', style: 'default' as const }];

    return (
        <AlertContext.Provider value={{ show, hide }}>
            {children}
            <Modal
                visible={visible}
                transparent
                animationType="none"
                statusBarTranslucent
                onRequestClose={hide}
            >
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : (
                        <View style={[StyleSheet.absoluteFill, styles.androidOverlay]} />
                    )}

                    <Animated.View
                        style={[
                            styles.alertContainer,
                            {
                                opacity: fadeAnim,
                                transform: [{ scale: scaleAnim }],
                            },
                        ]}
                    >
                        {/* Icon */}
                        {config?.type && (
                            <View style={styles.iconContainer}>
                                {getIcon()}
                            </View>
                        )}

                        {/* Title */}
                        <Text style={styles.title}>{config?.title}</Text>

                        {/* Message */}
                        {config?.message && (
                            <Text style={styles.message}>{config.message}</Text>
                        )}

                        {/* Buttons */}
                        <View style={[
                            styles.buttonContainer,
                            buttons.length === 2 && styles.buttonContainerRow,
                        ]}>
                            {buttons.map((button, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={getButtonStyle(button, index, buttons.length)}
                                    onPress={() => handleButtonPress(button)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={getButtonTextStyle(button, index, buttons.length)}>
                                        {button.text}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Animated.View>
                </Animated.View>
            </Modal>
        </AlertContext.Provider>
    );
}

let globalAlertRef: AlertContextType | null = null;

export function setGlobalAlertRef(ref: AlertContextType) {
    globalAlertRef = ref;
}

export function showAlert(config: AlertConfig) {
    if (globalAlertRef) {
        globalAlertRef.show(config);
    } else {
        console.warn('AlertProvider not mounted yet. Using native Alert as fallback.');
        // Fallback to native
        const { Alert } = require('react-native');
        Alert.alert(config.title, config.message);
    }
}
