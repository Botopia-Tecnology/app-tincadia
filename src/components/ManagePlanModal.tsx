import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Linking,
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../contexts/ThemeContext';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { APP_TIERS } from '../config/revenuecat.config';

interface ManagePlanModalProps {
    visible: boolean;
    onClose: () => void;
}

const WEB_PRICING_URL = 'https://tincadia.com/pricing';
const APPLE_MANAGE_SUBSCRIPTION_URL = 'itms-apps://buy.itunes.apple.com/WebObjects/MZFinance.woa/wa/manageSubscriptions';

// Identificadores de paquetes en RevenueCat para estilos especiales
const PACKAGE_METADATA = {
    PREMIUM: 'premium_mensual',
    BASICO: 'basico_mensual',
};

export function ManagePlanModal({ visible, onClose }: ManagePlanModalProps) {
    const { planTier, isPremium, subscriptionStatus, refreshSubscription } = useSubscription();
    const { colors, isDark } = useTheme();
    const [showPlanOptions, setShowPlanOptions] = React.useState(false);
    const [packages, setPackages] = React.useState<PurchasesPackage[]>([]);
    const [isLoadingPackages, setIsLoadingPackages] = React.useState(false);
    const [isPurchasing, setIsPurchasing] = React.useState(false);

    // Reset view when closing
    React.useEffect(() => {
        if (!visible) {
            setShowPlanOptions(false);
        }
    }, [visible]);

    React.useEffect(() => {
        if (showPlanOptions) {
            loadOfferings();
        }
    }, [showPlanOptions]);

    const loadOfferings = async () => {
        setIsLoadingPackages(true);
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
                setPackages(offerings.current.availablePackages);
                console.log('✅ [ManagePlanModal] Offerings loaded');
                console.log('📦 [ManagePlanModal] Package identifiers:', 
                    offerings.current.availablePackages.map(p => ({
                        identifier: p.identifier,
                        productId: p.product.identifier,
                    }))
                );
            } else {
                console.warn('⚠️ [ManagePlanModal] No offerings configured in RevenueCat');
            }
        } catch (e) {
            console.error('❌ [ManagePlanModal] Error loading offerings:', e);
            if (Platform.OS !== 'android') {
                Alert.alert('Error', 'No se pudieron cargar los planes disponibles.');
            }
        } finally {
            setIsLoadingPackages(false);
        }
    };

    const handleWebUpgrade = async () => {
        try {
            const supported = await Linking.canOpenURL(WEB_PRICING_URL);
            if (supported) {
                await Linking.openURL(WEB_PRICING_URL);
                onClose();
            } else {
                Alert.alert('Error', 'No se pudo abrir el enlace de pagos.');
            }
        } catch (error) {
            console.error('Error abriendo enlace:', error);
        }
    };

    const handleInAppPurchase = () => {
        setShowPlanOptions(true);
    };

    const handleBuyPlan = async (pkg: PurchasesPackage) => {
        setIsPurchasing(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            
            // Sync status
            await refreshSubscription(true);

            Alert.alert('¡Éxito!', `Has adquirido el ${pkg.product.title}.`);
            onClose();
        } catch (e: any) {
            if (!e.userCancelled) {
                Alert.alert('Error en la compra', e.message);
                console.error('Error purchasing:', e);
            }
        } finally {
            setIsPurchasing(false);
        }
    };

    const handleCancel = async () => {
        if (Platform.OS === 'ios') {
            // Redirigir a la gestión de suscripciones de Apple
            try {
                await Linking.openURL(APPLE_MANAGE_SUBSCRIPTION_URL);
            } catch {
                Alert.alert('Aviso', 'No pudimos abrir la gestión de suscripciones de Apple.');
            }
        } else {
            // En Android redirigimos a la plataforma web para cancelar
            handleWebUpgrade(); // Misma URL de gestión por ahora
        }
    };

    const daysRemaining = (() => {
        if (!subscriptionStatus?.currentPeriodEnd) return null;
        const endDate = new Date(subscriptionStatus.currentPeriodEnd);
        const today = new Date();
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    })();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: Platform.OS === 'ios' ? 40 : 24 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        {showPlanOptions ? (
                            <TouchableOpacity onPress={() => setShowPlanOptions(false)} style={styles.closeBtn}>
                                <Ionicons name="arrow-back" size={24} color={colors.text} />
                            </TouchableOpacity>
                        ) : <View style={{ width: 24 }} />}
                        <Text style={[styles.title, { color: colors.text }]}>
                            {showPlanOptions ? 'Seleccionar Plan' : 'Gestión de Plan'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {showPlanOptions ? (
                        <View style={styles.planOptionsContainer}>
                            {/* Plan Gratis siempre visible si no es premium */}
                            {!isPremium && (
                                <View style={[styles.planOptionCard, { borderColor: isDark ? '#333' : '#E5E7EB', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                                    <View style={styles.planOptionHeader}>
                                        <View style={styles.planOptionNameContainer}>
                                            <Text style={[styles.planOptionName, { color: colors.text }]}>Plan Gratis</Text>
                                        </View>
                                        <View style={styles.planOptionPriceContainer}>
                                            <Text style={[styles.planOptionPrice, { color: colors.textMuted }]}>Gratis</Text>
                                        </View>
                                    </View>
                                    <Text style={[styles.planOptionDesc, { color: colors.textMuted }]}>Acceso a chat de texto y videollamadas con límites.</Text>
                                    {planTier === APP_TIERS.GRATIS ? (
                                        <View style={[styles.currentPlanBadge, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                                            <Text style={[styles.currentPlanBadgeText, { color: colors.text }]}>Tu plan actual</Text>
                                        </View>
                                    ) : null}
                                </View>
                            )}

                            {/* Planes dinámicos de RevenueCat */}
                            {packages.map((pkg) => {
                                const isPkgPremium = pkg.identifier === PACKAGE_METADATA.PREMIUM;
                                const isCurrentPlan = (isPkgPremium && planTier === APP_TIERS.PREMIUM) || 
                                                    (pkg.identifier === PACKAGE_METADATA.BASICO && planTier === APP_TIERS.BASICO);

                                return (
                                    <View 
                                        key={pkg.identifier}
                                        style={[
                                            styles.planOptionCard, 
                                            isPkgPremium 
                                                ? { borderColor: '#F59E0B', backgroundColor: isDark ? '#45220B' : '#FFFBEB', borderWidth: 2 }
                                                : { borderColor: isDark ? '#4B5563' : '#D1D5DB', backgroundColor: isDark ? '#374151' : '#F9FAFB' }
                                        ]}
                                    >
                                        <View style={styles.planOptionHeader}>
                                            <View style={styles.planOptionNameContainer}>
                                                <Text style={[
                                                    styles.planOptionName, 
                                                    { color: isPkgPremium ? (isDark ? '#FCD34D' : '#D97706') : colors.text }
                                                ]}>
                                                    {pkg.product.title}
                                                </Text>
                                            </View>
                                            <View style={styles.planOptionPriceContainer}>
                                                <Text style={[
                                                    styles.planOptionPrice, 
                                                    { color: isPkgPremium ? (isDark ? '#FDE68A' : '#B45309') : colors.textMuted }
                                                ]}>
                                                    {pkg.product.priceString}
                                                </Text>
                                                <Text style={[
                                                    styles.planOptionPricePeriod,
                                                    { color: isPkgPremium ? (isDark ? '#FDE68A' : '#B45309') : colors.textMuted }
                                                ]}>
                                                    /mes
                                                </Text>
                                            </View>
                                        </View>
                                        <Text style={[
                                            styles.planOptionDesc, 
                                            { color: isPkgPremium ? (isDark ? '#FDE68A' : '#B45309') : colors.textMuted }
                                        ]}>
                                            {pkg.product.description}
                                        </Text>

                                        {isCurrentPlan ? (
                                            <View style={[styles.currentPlanBadge, { backgroundColor: isDark ? '#4B5563' : '#E5E7EB' }]}>
                                                <Text style={[styles.currentPlanBadgeText, { color: colors.text }]}>Tu plan actual</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity 
                                                style={[
                                                    styles.buyButton, 
                                                    { 
                                                        backgroundColor: isPkgPremium ? '#F59E0B' : '#4B5563', 
                                                        opacity: isPurchasing || isLoadingPackages ? 0.7 : 1 
                                                    }
                                                ]} 
                                                onPress={() => handleBuyPlan(pkg)}
                                                disabled={isPurchasing || isLoadingPackages}
                                            >
                                                <Text style={styles.buyButtonText}>
                                                    {isPurchasing ? 'Procesando...' : 'Seleccionar Plan'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <>
                            {/* Current Plan Card */}
                            <View style={[
                                styles.planCard, 
                                planTier === APP_TIERS.PREMIUM 
                                    ? { borderColor: '#F59E0B', backgroundColor: isDark ? '#45220B' : '#FFFBEB', borderWidth: 2 }
                                    : { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E5E7EB' }
                            ]}>
                                <View style={styles.planHeader}>
                                    <Text style={[
                                        styles.planName, 
                                        planTier === APP_TIERS.PREMIUM ? { color: isDark ? '#FCD34D' : '#D97706' } : { color: colors.text }
                                    ]}>
                                        {planTier === APP_TIERS.PREMIUM ? 'Plan Premium' : planTier === APP_TIERS.BASICO ? 'Plan Básico' : 'Plan Gratis'}
                                    </Text>
                                </View>
                                
                                {planTier !== APP_TIERS.GRATIS && daysRemaining !== null && (
                                    <Text style={[
                                        styles.planDetail, 
                                        planTier === APP_TIERS.PREMIUM ? { color: isDark ? '#FDE68A' : '#B45309' } : { color: colors.textMuted }
                                    ]}>
                                        Tu suscripción está activa. Quedan {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'} en el ciclo actual.
                                    </Text>
                                )}
                                {planTier === APP_TIERS.GRATIS && (
                                    <Text style={[styles.planDetail, { color: colors.textMuted }]}>
                                        Estás usando la versión gratuita con acceso limitado a funciones avanzadas.
                                    </Text>
                                )}
                            </View>

                            {/* Actions */}
                            {planTier === APP_TIERS.GRATIS ? (
                                <View style={styles.actions}>
                                    <Text style={[styles.upgradeTitle, { color: colors.text }]}>¿Querés más funciones?</Text>
                                    <View style={styles.featureList}>
                                        <Text style={[styles.featureItem, { color: colors.textMuted }]}>• Transcripción ilimitada</Text>
                                        <Text style={[styles.featureItem, { color: colors.textMuted }]}>• Correcciones con IA avanzadas</Text>
                                        <Text style={[styles.featureItem, { color: colors.textMuted }]}>• Intérpretes humanos en vivo</Text>
                                    </View>
                                    <TouchableOpacity onPress={handleInAppPurchase} activeOpacity={0.8}>
                                        <LinearGradient
                                            colors={isDark ? ['#374151', '#1F2937'] : ['#000000', '#333333']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.primaryButton}
                                        >
                                            <Ionicons name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google'} size={20} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.primaryButtonText}>
                                                Suscribirse con {Platform.OS === 'ios' ? 'Apple' : 'Play Store'}
                                            </Text>
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    {Platform.OS !== 'ios' && (
                                        <TouchableOpacity onPress={handleWebUpgrade} style={[styles.secondaryButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                                            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Pagar en Tincadia.com</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.actions}>
                                    <TouchableOpacity onPress={handleInAppPurchase} style={[styles.secondaryButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                                        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Gestionar Suscripción (App)</Text>
                                    </TouchableOpacity>
                                    {Platform.OS !== 'ios' && (
                                        <TouchableOpacity onPress={handleWebUpgrade} style={[styles.secondaryButton, { backgroundColor: isDark ? '#374151' : '#F3F4F6' }]}>
                                            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Actualizar Método de Pago (Web)</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={handleCancel} style={[styles.secondaryButton, styles.dangerButton, isDark && { backgroundColor: '#450a0a', borderColor: '#7f1d1d' }]}>
                                        <Text style={[styles.dangerButtonText, isDark && { color: '#fca5a5' }]}>Cancelar Suscripción</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end', // Bottom sheet style
    },
    container: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        width: '100%',
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1F2937',
    },
    closeBtn: {
        padding: 4,
    },
    planCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    planName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginLeft: 8,
    },
    planDetail: {
        fontSize: 14,
        color: '#4B5563',
        lineHeight: 20,
    },
    actions: {
        gap: 16,
    },
    upgradeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
    },
    featureList: {
        marginBottom: 16,
        gap: 6,
    },
    featureItem: {
        fontSize: 14,
        color: '#6B7280',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        paddingVertical: 16,
        borderRadius: 16,
        width: '100%',
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    dangerButton: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    dangerButtonText: {
        color: '#DC2626',
        fontSize: 16,
        fontWeight: '600',
    },
    planOptionsContainer: {
        gap: 16,
    },
    planOptionCard: {
        borderRadius: 20,
        padding: 24,
        borderWidth: 1.5,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    planOptionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    planOptionNameContainer: {
        flex: 1,
    },
    planOptionName: {
        fontSize: 17,
        fontWeight: '700',
        lineHeight: 22,
    },
    planOptionPriceContainer: {
        alignItems: 'flex-end',
    },
    planOptionPrice: {
        fontSize: 18,
        fontWeight: '800',
    },
    planOptionPricePeriod: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: -2,
    },
    planOptionDesc: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
        opacity: 0.9,
    },
    buyButton: {
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 2,
    },
    buyButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    currentPlanBadge: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    currentPlanBadgeText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
