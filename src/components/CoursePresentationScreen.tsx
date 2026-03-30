import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { contentService, Course } from '../services/content.service';
import { paymentsService } from '../services/payments.service';
import { useSubscription } from '../hooks/useSubscription';
import { BackArrowIcon } from './icons/NavigationIcons';
import { useTheme } from '../contexts/ThemeContext';
import { NavigateFunction } from '../types/navigation.types';

interface CoursePresentationScreenProps {
    courseId: string;
    onBack: () => void;
    onNavigate: NavigateFunction;
    userId: string;
}

export function CoursePresentationScreen({ courseId, onBack, onNavigate, userId }: CoursePresentationScreenProps) {
    const { colors, isDark } = useTheme();
    const { isPremium } = useSubscription(userId);
    const [course, setCourse] = useState<Course | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(true);

    useEffect(() => {
        loadData();
    }, [courseId, userId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [courseData, accessStatus] = await Promise.all([
                contentService.getCourseById(courseId),
                checkAccess()
            ]);
            setCourse(courseData);
            setHasAccess(accessStatus);
        } catch (error) {
            console.error('Failed to load course details', error);
        } finally {
            setLoading(false);
            setCheckingAccess(false);
        }
    };

    const checkAccess = async (): Promise<boolean> => {
        try {
            // First get course basic info to check if paid
            // Optimization: if we already fetched courseData we can use it, but here we do parallel.
            // Let's assume fetching course again is fast or use `courseData` if we did sequential.
            // For robust parallel:
            return await checkAccessForId(courseId);
        } catch (e) {
            return false;
        }
    };

    const checkAccessForId = async (id: string): Promise<boolean> => {
        try {
            // We need to know if it's paid. We can wait for course data or do a check.
            // Let's rely on paymentsService directly if possible or check after course loads.
            // Since we do parallel, we don't have course data yet. 
            // We will check purchase status directly assuming it might be paid.
            // If it's free, paymentsService might return false, but we handle "isPaid" logic after loading course.
            if (userId) {
                const purchased = await paymentsService.checkPurchaseStatus(userId, id, 'COURSE');
                return purchased;
            }
            return false;
        } catch (e) {
            console.error('Check access error', e);
            return false;
        }
    }

    const handleUnlock = async () => {
        // Redirection to web for unlock as requested
        const url = `https://tincadia.com/cursos`;
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert('Desbloquear', 'Visita tincadia.com/cursos para desbloquear este curso.');
        }
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!course) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>No se encontró la información del curso.</Text>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backButtonText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Determine effective access (Free, Premium, or Purchased)
    const isFree = !course.isPaid;
    const canAccess = isFree || isPremium || hasAccess;

    // Format price function removed to avoid pricing mentions on the app.

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <ScrollView style={styles.scrollView}>
                {/* Header Image */}
                <View style={styles.imageContainer}>
                    {course.thumbnailUrl ? (
                        <Image source={{ uri: course.thumbnailUrl }} style={styles.image} resizeMode="cover" />
                    ) : (
                        <View style={[styles.image, { backgroundColor: isDark ? colors.surface : '#e2e8f0', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 24, color: isDark ? colors.textSecondary : '#64748b', fontWeight: 'bold' }}>Tincadia</Text>
                        </View>
                    )}
                    <TouchableOpacity onPress={onBack} style={styles.headerBackButton}>
                        <BackArrowIcon size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.contentContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>{course.title}</Text>
                    <Text style={[styles.instructor, { color: colors.textSecondary }]}>Por {course.instructor || 'Tincadia'}</Text>

                    <View style={styles.badgeContainer}>
                        <View style={[styles.badge, course.isPaid ? { backgroundColor: isDark ? '#451a03' : '#fef3c7' } : { backgroundColor: isDark ? '#064e3b' : '#d1fae5' }]}>
                            <Text style={[styles.badgeText, course.isPaid ? { color: isDark ? '#fbbf24' : '#d97706' } : { color: isDark ? '#34d399' : '#059669' }]}>
                                {course.isPaid ? 'Exclusivo' : 'Gratuito'}
                            </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: isDark ? colors.surface : '#f3f4f6' }]}>
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{course.modules?.length || 0} Módulos</Text>
                        </View>
                    </View>

                    <Text style={[styles.descriptionLabel, { color: colors.text }]}>Sobre este curso</Text>
                    <Text style={[styles.description, { color: colors.textSecondary }]}>{course.description || 'Sin descripción disponible.'}</Text>

                    {/* Modules List Preview */}
                    <Text style={[styles.modulesLabel, { color: colors.text }]}>Contenido del Curso</Text>
                    {course.modules?.map((module, index) => (
                        <View key={module.id} style={[styles.moduleItem, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.moduleIndex, { color: colors.textMuted }]}>{index + 1}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.moduleTitle, { color: colors.text }]}>{module.title}</Text>
                                <Text style={[styles.moduleLessons, { color: colors.textSecondary }]}>{module.lessons?.length || 0} lecciones</Text>
                            </View>
                            {/* Lock Icon Logic */}
                            <View style={[styles.lockIconContainer, { backgroundColor: canAccess ? (isDark ? '#064e3b' : '#d1fae5') : (isDark ? colors.surface : '#e2e8f0') }]}>
                                <Text style={{ fontSize: 12, color: canAccess ? (isDark ? '#34d399' : '#059669') : (isDark ? colors.textMuted : '#64748b') }}>
                                    {canAccess ? 'Abierto' : 'Bloqueado'}
                                </Text>
                            </View>
                        </View>
                    ))}
                    {(!course.modules || course.modules.length === 0) && (
                        <Text style={{ color: colors.textMuted, fontStyle: 'italic' }}>No hay módulos cargados.</Text>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                <View style={styles.priceInfo}>
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>{canAccess ? 'Acceso disponible' : 'Contenido exclusivo'}</Text>
                    <Text style={[styles.priceValue, { color: colors.text }, canAccess && { color: colors.success }]}>
                        {canAccess ? 'Desbloqueado' : 'Bloqueado'}
                    </Text>
                </View>

                {canAccess ? (
                    <TouchableOpacity
                        style={[styles.buyButton, { backgroundColor: '#2563eb' }]}
                        onPress={() => onNavigate('course_player', { courseId: course.id })}
                    >
                        <Text style={styles.buyButtonText}>Ir al Curso ▶</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.buyButton, { backgroundColor: '#dc2626' }]} onPress={handleUnlock}>
                        <Text style={styles.buyButtonText}>Desbloquear en la web</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    imageContainer: {
        width: '100%',
        height: 250,
        position: 'relative',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    headerBackButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: '800', // Extra bold
        color: '#1a1a1a',
        marginBottom: 8,
    },
    instructor: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16,
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    badge: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    badgeText: {
        fontSize: 14,
        color: '#4b5563',
        fontWeight: '600',
    },
    descriptionLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 8,
    },
    description: {
        fontSize: 16,
        color: '#4b5563',
        lineHeight: 24,
        marginBottom: 30,
    },
    modulesLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1a1a1a',
        marginBottom: 16,
    },
    moduleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    moduleIndex: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#9ca3af',
        width: 30,
    },
    moduleTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    moduleLessons: {
        fontSize: 14,
        color: '#9ca3af',
    },
    lockIconContainer: {
        marginLeft: 10,
        backgroundColor: '#e2e8f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    errorText: {
        fontSize: 16,
        color: 'red',
        marginBottom: 20,
    },
    backButton: {
        padding: 10,
    },
    backButtonText: {
        color: 'blue',
        fontSize: 16,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
    },
    priceInfo: {
        flex: 1,
    },
    priceLabel: {
        fontSize: 12,
        color: '#666',
        marginBottom: 2,
    },
    priceValue: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    buyButton: {
        backgroundColor: '#dc2626', // Red for buy
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    buyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
