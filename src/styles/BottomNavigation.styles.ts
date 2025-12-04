import { StyleSheet } from 'react-native';

export const bottomNavigationStyles = StyleSheet.create({
    bottomContainer: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        backgroundColor: 'transparent',
        zIndex: 1000, // Ensure it sits above other content
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
    tincadiaIconContainer: {
        // Container to handle touch events properly
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
    navLabel: {
        fontSize: 10,
        color: '#999999',
        marginTop: 2,
    },
    navLabelActive: {
        color: '#000000',
        fontWeight: '600',
    },
    // Floating Menu Styles
    menuOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)', // Lighter, blur-like background
        zIndex: 999,
    },
    floatingMenuContainer: {
        position: 'absolute',
        bottom: 90,
        right: 24,
        alignItems: 'flex-end',
        zIndex: 1001,
    },
    floatingMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    floatingLabel: {
        fontSize: 16,
        color: '#000000',
        marginRight: 12,
        fontWeight: '500',
    },
    floatingButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#376A3E', // Tincadia Green
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    floatingButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
