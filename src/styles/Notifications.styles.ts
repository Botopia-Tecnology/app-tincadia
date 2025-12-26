/**
 * Notifications Screen Styles
 */

import { StyleSheet } from 'react-native';

const COLORS = {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    primary: '#7FA889',
    primaryLight: '#E8F5E9',
    text: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
    border: '#E5E7EB',
    news: '#3B82F6',
    update: '#10B981',
    promotion: '#F59E0B',
};

export const notificationsStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        backgroundColor: COLORS.surface,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        flexDirection: 'row',
        alignItems: 'center',
    },

    backButton: {
        padding: 8,
        marginRight: 8,
    },

    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.text,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    listContent: {
        padding: 16,
    },

    notificationItem: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    notificationItemUnread: {
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary,
    },

    typeIndicator: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },

    typeNews: {
        backgroundColor: '#EBF5FF',
    },

    typeUpdate: {
        backgroundColor: '#ECFDF5',
    },

    typePromotion: {
        backgroundColor: '#FFFBEB',
    },

    typeIcon: {
        fontSize: 18,
    },

    notificationContent: {
        flex: 1,
    },

    notificationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 4,
    },

    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
    },

    notificationTitleUnread: {
        fontWeight: '700',
    },

    notificationTime: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginLeft: 8,
    },

    notificationMessage: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },

    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        position: 'absolute',
        top: 16,
        right: 16,
    },

    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },

    emptyIcon: {
        marginBottom: 16,
    },

    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },

    emptySubtext: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
});
