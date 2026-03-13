import { StyleSheet } from 'react-native';

/**
 * Styles for ChatInput component
 */
export const chatInputStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 8,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    attachButton: {
        padding: 5,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputContainerWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        paddingRight: 8,
        overflow: 'hidden', // Ensures overlay respects rounded corners
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: '#000',
    },
    sendButton: {
        marginLeft: 8,
        backgroundColor: '#4CAF50',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 70,
        height: 40,
    },
    sendButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    sendText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actionButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    correctionOverlay: {
        ...StyleSheet.absoluteFillObject, // Fill the wrapper
        backgroundColor: 'rgba(255, 235, 59, 0.2)',
        borderRadius: 20, // Match inputContainerWrapper border radius
    },
});

/**
 * Styles for ChatListItem component
 */
export const chatListItemStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E0E0E0',
    },
    content: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
        flex: 1,
    },
    time: {
        fontSize: 12,
        color: '#999999',
        marginLeft: 8,
    },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    lastMessage: {
        fontSize: 14,
        color: '#666666',
        flex: 1,
    },
    badge: {
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: 8,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

/**
 * Styles for MessageBubble component
 */
export const messageBubbleStyles = StyleSheet.create({
    container: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    containerMine: {
        alignItems: 'flex-end',
    },
    containerOther: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
    },
    bubbleMine: {
        backgroundColor: '#4CAF50',
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: '#E5E5EA',
        borderBottomLeftRadius: 4,
    },
    content: {
        fontSize: 16,
        lineHeight: 22,
    },
    contentMine: {
        color: '#FFFFFF',
    },
    contentOther: {
        color: '#000000',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
    },
    time: {
        fontSize: 11,
    },
    timeMine: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    timeOther: {
        color: '#999999',
    },
    pending: {
        fontSize: 10,
        marginLeft: 4,
    },
    checkmarks: {
        fontSize: 12,
        marginLeft: 4,
        fontWeight: '600',
    },
});
