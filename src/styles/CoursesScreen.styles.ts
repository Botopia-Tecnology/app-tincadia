import { StyleSheet } from 'react-native';

export const coursesScreenStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backIcon: {
        fontSize: 24,
        color: '#000000',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000000',
    },
    notificationButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notificationIcon: {
        fontSize: 24,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100, // Space for bottom nav
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000',
        marginTop: 24,
        marginBottom: 16,
    },
    courseCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        padding: 12,
        marginBottom: 12,
        alignItems: 'center',
    },
    courseIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#F5F5F5', // Placeholder color
        marginRight: 12,
    },
    courseInfo: {
        flex: 1,
    },
    courseTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000000',
        marginBottom: 4,
    },
    courseDescription: {
        fontSize: 12,
        color: '#666666',
        marginBottom: 8,
        lineHeight: 16,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
    },
    tagText: {
        fontSize: 10,
        color: '#666666',
        fontWeight: '500',
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        backgroundColor: '#FFFFFF',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    navItemActive: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingVertical: 4,
    },
    navIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    navLabel: {
        fontSize: 10,
        color: '#999999',
    },
    navLabelActive: {
        color: '#000000',
        fontWeight: '600',
    },
});
