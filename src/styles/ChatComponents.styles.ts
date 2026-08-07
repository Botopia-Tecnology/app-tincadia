import { StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

/**
 * Styles for DateSeparator component
 */
export const dateSeparatorStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        marginVertical: 12,
        marginBottom: 8,
    },
    bubble: {
        backgroundColor: 'rgba(229, 231, 235, 0.8)', // gray-200 with opacity
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    text: {
        fontSize: 12,
        color: '#4B5563', // gray-600
        fontWeight: '600',
    },
});

/**
 * Styles for MessageBubble Media elements
 */
export const messageBubbleMediaStyles = StyleSheet.create({
    placeholder: {
        width: 200,
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.1)',
        borderRadius: 10,
    },
    thumbnail: {
        width: 200,
        height: 150,
        borderRadius: 10,
    },
    videoThumbWrap: {
        width: 200,
        height: 150,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
    },
    videoNoteThumbWrap: {
        width: 180,
        height: 180,
        borderRadius: 90,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#111',
    },
    videoNoteThumbnail: {
        width: 180,
        height: 180,
        borderRadius: 90,
    },
    videoNoteBubble: {
        backgroundColor: 'transparent',
        maxWidth: '80%',
    },
    videoNoteOuter: {
        position: 'relative',
        alignSelf: 'flex-start',
    },
    videoNoteFooter: {
        position: 'absolute',
        right: 10,
        bottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    videoNoteTime: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '500',
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.22)',
    },
    videoPlayBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoNotePlayBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audio: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 180,
    },
    audioWave: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 10,
        gap: 2,
    },
    audioBar: {
        width: 3,
        borderRadius: 2,
    },
    audioTranscriptToggle: {
        marginTop: 4,
        paddingHorizontal: 12,
        paddingBottom: 2,
        alignSelf: 'flex-start',
    },
    audioTranscriptToggleText: {
        fontSize: 11,
        fontWeight: '600',
    },
    audioTranscriptBox: {
        marginTop: 2,
        marginHorizontal: 8,
        marginBottom: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    audioTranscriptBoxMine: {
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    audioTranscriptText: {
        fontSize: 12,
        lineHeight: 16,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullscreenImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.8,
    },
    fullscreenVideo: {
        width: '100%',
        flex: 1,
        backgroundColor: '#000',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    document: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        minWidth: 200,
        maxWidth: 250,
    },
    documentIconContainer: {
        marginRight: 12,
        backgroundColor: 'rgba(0,0,0,0.05)',
        padding: 8,
        borderRadius: 8,
    },
    documentTextContainer: {
        flex: 1,
    },
    documentName: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    documentSubtext: {
        fontSize: 11,
    },
});

/**
 * Styles for ChatListItem preview row
 */
export const chatListItemPreviewStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
    },
});
