import { StyleSheet } from 'react-native';

export const sosScreenStyles = StyleSheet.create({
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
        padding: 16,
    },
    descriptionContainer: {
        marginBottom: 24,
    },
    descriptionText: {
        fontSize: 14,
        color: '#333333',
        textAlign: 'center',
        marginBottom: 12,
    },
    userTagContainer: {
        alignSelf: 'center',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    userTagText: {
        fontSize: 12,
        color: '#666666',
    },
    emergencyGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    emergencyButton: {
        width: '48%',
        aspectRatio: 1,
        backgroundColor: '#7FA889',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        padding: 16,
    },
    emergencyIconContainer: {
        marginBottom: 12,
    },
    emergencyIcon: {
        fontSize: 48,
    },
    emergencyLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    locationInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    locationIcon: {
        fontSize: 20,
        marginRight: 8,
        marginTop: 2,
    },
    locationTextContainer: {
        flex: 1,
    },
    locationText: {
        fontSize: 13,
        color: '#333333',
        marginBottom: 4,
    },
    emergencyInfoLink: {
        fontSize: 12,
        color: '#007AFF',
        textDecorationLine: 'underline',
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
    },
    bottomNav: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 30,
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginRight: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
    },
    tincadiaIcon: {
        width: 48,
        height: 48,
        resizeMode: 'contain',
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
