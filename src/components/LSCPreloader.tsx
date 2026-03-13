import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from '../config/api.config';

/**
 * LSCPreloader
 * 
 * Invisible component that loads the LSC streaming HTML in "warmup" mode.
 * This triggers the download and caching of MediaPipe models (10MB+) 
 * while the user is navigating the app, so the actual feature opens instantly.
 */
export const LSCPreloader = () => {
    const [htmlContent, setHtmlContent] = useState<string | null>(null);

    useEffect(() => {
        const loadHtml = async () => {
            try {
                // 1. Resolve and download asset
                const asset = Asset.fromModule(require('../assets/html/streaming-lsc.html'));
                if (!asset.localUri) {
                    await asset.downloadAsync();
                }

                if (asset.localUri) {
                    let content = await FileSystem.readAsStringAsync(asset.localUri);

                    // 2. Inject API URL
                    const socketUrl = API_URL.replace(/\/api\/?$/, '');
                    content = content.replace(
                        /const apiUrl = urlParams.get\('apiUrl'\) \|\| 'http:\/\/localhost:3001';/g,
                        `const apiUrl = '${socketUrl}';`
                    );

                    // 3. Inject Warmup Mode flag
                    // We append it to the window location logic or just handle via injected JS
                    // But simpler: The HTML checks 'window.location.search'. 
                    // Since we load string, we can't easily set URL params unless we serve from localhost.
                    // hack: We can replacement-inject a flag variable or simulate the check.

                    // Actually, WebView 'source={{ html }}' doesn't support query params well.
                    // Better approach: Inject a script that polyfills URLSearchParams or sets a global flag.
                    const logicInjection = `
                        // Force Warmup Mode via injection
                        window.LSC_WARMUP = true;
                        // Also try to set search if possible, but LSC_WARMUP is primary check
                        try { window.location.search = '?mode=warmup'; } catch(e){}
                    `;

                    // Inject at start of head
                    content = content.replace('<head>', `<head><script>${logicInjection}</script>`);

                    setHtmlContent(content);
                    console.log('🔥 [LSC Preloader] Started background warmup...');
                }
            } catch (error) {
                console.warn('[LSC Preloader] Failed to load:', error);
            }
        };

        // Delay warmup slightly (2s) to prioritize initial App render
        const timer = setTimeout(loadHtml, 2000);
        return () => clearTimeout(timer);
    }, []);

    if (!htmlContent) return null;

    return (
        <View style={{ height: 0, width: 0, overflow: 'hidden', position: 'absolute', opacity: 0 }}>
            <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                javaScriptEnabled={true}
                domStorageEnabled={true} // Crucial for Caching
                onError={(e) => console.log('[LSC Preloader] WebView Error:', e.nativeEvent)}
                onMessage={(event) => {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'log') {
                        // Uncomment to debug warmup
                        console.log('[LSC Warmup Log]', data.payload);
                    }
                    if (data.payload === 'warmup_complete') {
                        console.log('✅ [LSC Preloader] Warmup Complete! Models cached.');
                        // We can optionally unmount to save memory, 
                        // but keeping it might keep the JS context fresh (trade-off memory vs speed).
                        // For now we keep it.
                    }
                }}
            />
        </View>
    );
};
