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
    Linking,
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
        title: '¡Límite de transcripción alcanzado!',
        description: 'En tu plan básico puedes usar la transcripción de voz a texto una vez al día. Mejora tu plan para uso ilimitado en tiempo real.',
        gradient: ['#F59E0B', '#EF4444'] as [string, string],
    },
    lsc: {
        icon: 'hand-left' as const,
        title: 'Interpretación LSC no disponible',
        description: 'La interpretación en Lengua de Señas Colombiana (LSC) en tiempo real es una función Premium. Mejora tu plan para desbloquear esta característica.',
        gradient: ['#8B5CF6', '#EC4899'] as [string, string],
    },
    correction: {
        icon: 'sparkles' as const,
        title: '¡Límite de correcciones alcanzado!',
        description: 'En tu plan básico puedes usar el asistente de escritura con IA una vez al día. Mejora tu plan para correcciones ilimitadas.',
        gradient: ['#F472B6', '#A855F7'] as [string, string],
    },
    transcription_blocked: {
        icon: 'mic' as const,
        title: 'Transcripción no disponible',
        description: 'La transcripción de voz a texto no está incluida en tu plan gratuito. Suscríbete para desbloquear esta función.',
        gradient: ['#F59E0B', '#EF4444'] as [string, string],
    },
    correction_blocked: {
        icon: 'sparkles' as const,
        title: 'Corrección IA no disponible',
        description: 'El asistente de escritura con IA no está incluido en tu plan gratuito. Suscríbete para desbloquear esta función.',
        gradient: ['#F472B6', '#A855F7'] as [string, string],
    },
    tts: {
        icon: 'volume-high' as const,
        title: 'Texto a voz no disponible',
        description: 'La conversión de texto a voz no está incluida en tu plan actual. Mejora tu plan para desbloquear esta función.',
        gradient: ['#F97316', '#EA580C'] as [string, string],
    },
    interpreter: {
        icon: 'videocam' as const,
        title: 'Intérprete no disponible',
        description: 'La solicitud de intérprete de Lengua de Señas es una función exclusiva del plan Premium. Mejora tu plan para acceder a intérpretes en tiempo real.',
        gradient: ['#3B82F6', '#1E40AF'] as [string, string],
    },
};

export function UpgradeModal({ visible, onClose, feature }: UpgradeModalProps) {
    const config = FEATURE_CONFIG[feature];

    const handleUpgrade = () => {
        Linking.openURL('https://www.tincadia.com/pricing');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Premium Badge */}
                    <LinearGradient
                        colors={config.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconContainer}
                    >
                        <Ionicons name={config.icon} size={36} color="#FFF" />
                    </LinearGradient>

                    {/* Lock indicator */}
                    <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={14} color="#FFF" />
                    </View>

                    <Text style={styles.title}>{config.title}</Text>
                    <Text style={styles.description}>{config.description}</Text>

                    {/* Features list */}
                    <View style={styles.featuresList}>
                        <View style={styles.featureRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.featureText}>Transcripción de voz ilimitada</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.featureText}>Interpretación LSC en vivo</Text>
                        </View>
                        <View style={styles.featureRow}>
                            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                            <Text style={styles.featureText}>Todas las funciones premium</Text>
                        </View>
                    </View>

                    {/* CTA Button */}
                    <TouchableOpacity onPress={handleUpgrade} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#4F46E5', '#7C3AED']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaButton}
                        >
                            <Ionicons name="star" size={18} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={styles.ctaText}>Mejorar Plan</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Dismiss */}
                    <TouchableOpacity onPress={onClose} style={styles.dismissButton}>
                        <Text style={styles.dismissText}>Ahora no</Text>
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
