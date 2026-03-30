/**
 * UpgradeModal Component
 * 
 * Shows a premium upgrade prompt when a user on the free plan
 * tries to access a restricted feature.
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface UpgradeModalProps {
    visible: boolean;
    onClose: () => void;
    feature: 'transcription' | 'transcription_blocked' | 'lsc' | 'correction' | 'correction_blocked' | 'tts' | 'interpreter';
}

const FEATURE_CONFIG = {
    transcription: {
        icon: 'mic' as const,
        title: '¡Límite alcanzado!',
        description: 'Has alcanzado el límite de transcripciones de voz a texto permitido para tu plan actual.',
        gradient: ['#F59E0B', '#EF4444'] as [string, string],
    },
    lsc: {
        icon: 'hand-left' as const,
        title: 'Función no disponible',
        description: 'La interpretación en Lengua de Señas Colombiana (LSC) mediante Avatar no está disponible en tu plan actual.',
        gradient: ['#8B5CF6', '#EC4899'] as [string, string],
    },
    correction: {
        icon: 'sparkles' as const,
        title: '¡Límite alcanzado!',
        description: 'Has alcanzado el límite de correcciones con Inteligencia Artificial permitido para tu plan actual.',
        gradient: ['#F472B6', '#A855F7'] as [string, string],
    },
    transcription_blocked: {
        icon: 'mic' as const,
        title: 'Función no disponible',
        description: 'La transcripción de voz a texto no está incluida en tu plan actual.',
        gradient: ['#F59E0B', '#EF4444'] as [string, string],
    },
    correction_blocked: {
        icon: 'sparkles' as const,
        title: 'Función no disponible',
        description: 'El asistente automático de correcciones con IA no está incluido en tu plan actual.',
        gradient: ['#F472B6', '#A855F7'] as [string, string],
    },
    tts: {
        icon: 'volume-high' as const,
        title: 'Función no disponible',
        description: 'La conversión de texto a voz no está incluida en tu plan actual.',
        gradient: ['#F97316', '#EA580C'] as [string, string],
    },
    interpreter: {
        icon: 'videocam' as const,
        title: 'Función no disponible',
        description: 'El servicio prioritario para solicitar intérpretes de Lengua de Señas humanos es exclusivo del plan Premium.',
        gradient: ['#3B82F6', '#1E40AF'] as [string, string],
    },
};

export function UpgradeModal({ visible, onClose, feature }: UpgradeModalProps) {
    const config = FEATURE_CONFIG[feature];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Premium Badge / Icon */}
                    <LinearGradient
                        colors={config.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconContainer}
                    >
                        <Ionicons name={config.icon} size={36} color="#FFF" />
                    </LinearGradient>

                    <Text style={styles.title}>{config.title}</Text>
                    <Text style={styles.description}>{config.description}</Text>

                    {/* Simple Dismiss Button instead of CTA */}
                    <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={{ width: '100%' }}>
                        <LinearGradient
                            colors={['#4F46E5', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaButton}
                        >
                            <Text style={styles.ctaText}>Entendido</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 15,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    lockBadge: {
        position: 'absolute',
        top: 80,
        right: '35%',
        backgroundColor: '#EF4444',
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1F2937',
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    featuresList: {
        alignSelf: 'stretch',
        marginBottom: 24,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 10,
    },
    featureText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '500',
    },
    ctaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        minWidth: 240,
    },
    ctaText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    dismissButton: {
        marginTop: 16,
        paddingVertical: 8,
    },
    dismissText: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '500',
    },
});
