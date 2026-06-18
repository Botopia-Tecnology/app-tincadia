import { StyleSheet } from 'react-native';

export const audioRecorderStyles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderColor: '#E5E7EB',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    timerText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1F2937',
        fontVariant: ['tabular-nums'],
        marginRight: 16,
        minWidth: 40,
    },
    waveformContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 30,
        gap: 2,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#6B7280',
        borderRadius: 1.5,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cancelButton: {
        padding: 10,
    },
    pauseButton: {
        padding: 10,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export const streamingLscRecorderStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: '#111',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTitleContainer: {
        alignItems: 'center',
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        color: '#ccc',
        fontSize: 12,
    },
    closeButton: {
        padding: 5,
    },
    webviewContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    webview: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        color: 'white',
        marginBottom: 20,
        fontSize: 16,
    },
    permissionButton: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    footer: {
        padding: 20,
        backgroundColor: '#111',
        alignItems: 'center',
    },
    footerText: {
        color: '#888',
        textAlign: 'center',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    loadingText: {
        color: '#888',
        marginTop: 10,
        fontSize: 14,
    },
});

export const videoTranslationRecorderStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    flipButton: {
        padding: 8,
    },
    clipCounter: {
        backgroundColor: 'rgba(79, 70, 229, 0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'center',
        borderRadius: 16,
        marginBottom: 8,
    },
    clipCounterText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    cameraContainer: {
        flex: 1,
    },
    camera: {
        flex: 1,
    },
    videoPreview: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionText: {
        color: 'white',
        fontSize: 16,
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    countdownOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    countdownText: {
        fontSize: 120,
        fontWeight: 'bold',
        color: 'white',
    },
    countdownSubtext: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 10,
    },
    recordingIndicator: {
        position: 'absolute',
        top: 20,
        left: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
        marginRight: 8,
    },
    recordingText: {
        color: 'white',
        fontSize: 14,
    },
    clipList: {
        maxHeight: 70,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    clipListContent: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 10,
    },
    clipThumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#374151',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    clipThumbnailActive: {
        borderWidth: 2,
        borderColor: '#4F46E5',
    },
    clipNumber: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    clipLoader: {
        position: 'absolute',
    },
    clipDone: {
        position: 'absolute',
        bottom: 2,
        right: 2,
    },
    clipDelete: {
        position: 'absolute',
        top: -5,
        right: -5,
    },
    controls: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    recordingControls: {
        alignItems: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'white',
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#EF4444',
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(239,68,68,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#EF4444',
    },
    stopButtonInner: {
        width: 30,
        height: 30,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    countdownSmall: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    recordingHint: {
        color: 'white',
        marginTop: 12,
        fontSize: 14,
    },
    previewControls: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        gap: 6,
    },
    addButton: {
        backgroundColor: '#4F46E5',
    },
    translateButton: {
        backgroundColor: '#22C55E',
    },
    actionButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    processingText: {
        color: 'white',
        marginTop: 16,
        fontSize: 16,
    },
});
