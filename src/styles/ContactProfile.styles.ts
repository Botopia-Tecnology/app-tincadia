import { StyleSheet, Platform } from 'react-native';

/**
 * Styles for ContactProfileScreen component
 * Modern design inspired by WhatsApp with Tincadia's color palette - Light Mode
 */

// Tincadia Color Palette - Light Mode
const COLORS = {
    primary: '#7FA889',      // Tincadia green
    primaryDark: '#5E8A68',  // Darker green for headers
    primaryLight: '#EEF7F0', // Light green background
    background: '#FFFFFF',   // White background
    surface: '#F9FAFB',      // Light gray surface
    surfaceAlt: '#F3F4F6',   // Alternative surface
    text: '#111827',         // Dark text
    textSecondary: '#6B7280', // Gray text
    textMuted: '#9CA3AF',    // Muted text
    border: '#E5E7EB',       // Light border
    accent: '#10B981',       // Emerald accent
    danger: '#EF4444',       // Red for destructive actions
    white: '#FFFFFF',
};

export const contactProfileStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.surface,
    },

    // Loading state
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
    },

    // Header Section - Full width with avatar centered
    header: {
        backgroundColor: COLORS.white,
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 0 : 10,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    // Navigation row at top
    headerNavRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 20,
    },

    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceAlt,
        justifyContent: 'center',
        alignItems: 'center',
    },

    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
    },

    editButtonText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '600',
    },

    // Large Avatar
    avatarContainer: {
        marginBottom: 16,
    },

    avatarLarge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: COLORS.white,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
    },

    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: COLORS.white,
    },

    // Header Text
    headerName: {
        fontSize: 26,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
        textAlign: 'center',
    },

    headerPhone: {
        fontSize: 17,
        color: COLORS.textSecondary,
        fontWeight: '500',
        marginTop: 2,
    },

    originalName: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 8,
        fontStyle: 'italic',
    },

    // Content Section
    content: {
        flex: 1,
        backgroundColor: COLORS.surface,
    },

    // Section Cards
    section: {
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        overflow: 'hidden',
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },

    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },

    // Fields
    field: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    fieldLast: {
        borderBottomWidth: 0,
    },

    fieldLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 6,
        fontWeight: '500',
    },

    fieldValue: {
        fontSize: 16,
        color: COLORS.text,
        fontWeight: '400',
    },

    fieldValueEmpty: {
        fontSize: 16,
        color: COLORS.textMuted,
        fontStyle: 'italic',
    },

    // Phone with lock icon
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    phoneText: {
        fontSize: 16,
        color: COLORS.text,
        flex: 1,
    },

    phoneLock: {
        fontSize: 16,
        marginLeft: 8,
    },

    // Input fields
    input: {
        backgroundColor: COLORS.surfaceAlt,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    inputFocused: {
        borderColor: COLORS.primary,
    },

    inputDisabled: {
        backgroundColor: COLORS.surface,
        color: COLORS.textMuted,
    },

    // Action Buttons Container
    buttonContainer: {
        flexDirection: 'row',
        gap: 12,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
    },

    // Save Button
    saveButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        // Shadow
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },

    saveButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },

    // Cancel Button
    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    cancelButtonText: {
        color: COLORS.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },

    // Add Contact Button
    addContactButton: {
        backgroundColor: COLORS.primary,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8,
        // Shadow
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },

    addContactIcon: {
        fontSize: 20,
    },

    addContactButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },

    // Info Section at bottom
    infoSection: {
        backgroundColor: COLORS.white,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 32,
        borderRadius: 16,
        padding: 16,
        // Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },

    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },

    infoRowLast: {
        borderBottomWidth: 0,
    },

    infoIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primaryLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },

    infoIconText: {
        fontSize: 18,
    },

    infoContent: {
        flex: 1,
    },

    infoTitle: {
        fontSize: 15,
        color: COLORS.text,
        fontWeight: '500',
    },

    infoSubtitle: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 2,
    },

    // Media Section
    mediaSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 16,
    },

    mediaCount: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },

    mediaLoading: {
        padding: 20,
        alignItems: 'center',
    },

    mediaGrid: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        gap: 8,
    },

    mediaItem: {
        width: 80,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: COLORS.surfaceAlt,
    },

    mediaImage: {
        width: '100%',
        height: '100%',
    },
});
