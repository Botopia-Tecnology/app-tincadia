import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Alert,
    Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../../config/api.config';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { streamingLscRecorderStyles as styles } from '../../../styles/ChatRecorders.styles';

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
                const asset = Asset.fromModule(require('../../../assets/html/streaming-lsc.html'));
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

    const handleMessage = (event: WebViewMessageEvent) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
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
