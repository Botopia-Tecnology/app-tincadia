import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../config/api.config';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

interface StreamingLSCRecorderProps {
    visible: boolean;
    onClose: () => void;
    onTranslationReceived: (text: string) => void;
}

export function StreamingLSCRecorder({
    visible,
    onClose,
    onTranslationReceived,
}: StreamingLSCRecorderProps) {
    const [permission, requestPermission] = useCameraPermissions();
    const webViewRef = useRef<WebView>(null);
    const [status, setStatus] = useState<'disconnected' | 'connected' | 'error'>('disconnected');
    const [htmlContent, setHtmlContent] = useState<string | null>(null);

    useEffect(() => {
        if (visible && !permission?.granted) {
            requestPermission();
        }
    }, [visible, permission]);

    // Load HTML asset as string
    useEffect(() => {
        const loadHtml = async () => {
            try {
                // Resolve asset
                const asset = Asset.fromModule(require('../../assets/html/streaming-lsc.html'));
                if (!asset.localUri) {
                    await asset.downloadAsync(); // Ensure it's downloaded/cached
                }

                // Read as string
                if (asset.localUri) {
                    let content = await FileSystem.readAsStringAsync(asset.localUri);

                    // Inject correct API URL
                    // Remove '/api' suffix if present: Socket.io now connects to root namespace
                    const socketUrl = API_URL.replace(/\/api\/?$/, '');
                    console.log('🔌 Socket URL for LSC:', socketUrl);
                    
                    content = content.replace(
                        "const apiUrl = urlParams.get('apiUrl') || 'http://localhost:3001';",
                        `const apiUrl = '${socketUrl}';`
                    );

                    setHtmlContent(content);
                    console.log('✅ HTML content loaded and URL injected');
                }
            } catch (error) {
                console.error('Failed to load HTML asset:', error);
                Alert.alert('Error', 'No se pudo cargar la interfaz de cámara.');
            }
        };

        if (visible) {
            loadHtml();
        }
    }, [visible]);

    const handleMessage = (event: any) => {
        // ... same handler ...
        try {
            const data = JSON.parse(event.nativeEvent.data);
            // ... switch/case ...
            switch (data.type) {
                case 'status':
                    setStatus(data.payload);
                    break;
                case 'confirmed':
                    onTranslationReceived(data.payload);
                    break;
                case 'error':
                    Alert.alert('Error', data.payload);
                    break;
            }
        } catch (err) {
            console.error('Error parsing WebView message:', err);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header ... same ... */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>Reconocimiento en Vivo</Text>
                        <View style={styles.statusContainer}>
                            <View style={[
                                styles.statusDot,
                                { backgroundColor: status === 'connected' ? '#22C55E' : '#EF4444' }
                            ]} />
                            <Text style={styles.statusText}>
                                {status === 'connected' ? 'IA Conectada' : 'Conectando...'}
                            </Text>
                        </View>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* WebView Container */}
                <View style={styles.webviewContainer}>
                    {!permission?.granted ? (
                        <View style={styles.permissionContainer}>
                            <Text style={styles.permissionText}>Se necesita acceso a la cámara</Text>
                            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
                                <Text style={styles.permissionButtonText}>Dar Permiso</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        htmlContent ? (
                            <WebView
                                ref={webViewRef}
                                source={{
                                    html: htmlContent,
                                    baseUrl: 'http://localhost/' // Use HTTP to avoid mixed content issues
                                }}
                                style={styles.webview}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                mediaPlaybackRequiresUserAction={false}
                                allowsInlineMediaPlayback={true}
                                originWhitelist={['*']}
                                onMessage={handleMessage}
                                injectedJavaScript={`
                                    window.API_URL = "${API_URL}";
                                `}
                                androidLayerType="hardware"
                                mixedContentMode="always"
                                allowUniversalAccessFromFileURLs={true}
                                onError={(syntheticEvent) => {
                                    const { nativeEvent } = syntheticEvent;
                                    console.warn('WebView error:', nativeEvent);
                                }}
                            />
                        ) : (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#4F46E5" />
                                <Text style={styles.loadingText}>Cargando cámara...</Text>
                            </View>
                        )
                    )}
                </View>
                {/* Footer ... same ... */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Realiza una seña frente a la cámara. Haz clic en la predicción para confirmar.
                    </Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
