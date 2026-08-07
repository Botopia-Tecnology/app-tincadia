/**
 * Visor in-app de documentos (estilo WhatsApp).
 * PDF e imágenes se muestran dentro de la app; archivos sin preview usan
 * IntentLauncher (Android) / Linking (iOS) como fallback.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

interface Props {
  visible: boolean;
  onClose: () => void;
  uri: string | null;
  fileName?: string;
  mimeType?: string;
  localUri?: string | null;
}

function isImageMime(mime?: string, name?: string) {
  if (mime?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(name || '');
}

function isPdfMime(mime?: string, name?: string) {
  if (mime === 'application/pdf') return true;
  return /\.pdf$/i.test(name || '');
}

function buildPdfHtml(sourceUrl: string) {
  const escaped = JSON.stringify(sourceUrl);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #1f1f1f; }
    #status { color: #fff; text-align: center; padding: 24px; font-family: sans-serif; }
    #viewer { padding: 8px 0 40px; }
    canvas { display: block; margin: 10px auto; max-width: 100%; height: auto; box-shadow: 0 2px 8px rgba(0,0,0,.4); }
  </style>
</head>
<body>
  <div id="status">Cargando documento…</div>
  <div id="viewer"></div>
  <script>
    (function () {
      var statusEl = document.getElementById('status');
      var viewer = document.getElementById('viewer');
      if (!window.pdfjsLib) {
        statusEl.textContent = 'No se pudo cargar el visor PDF.';
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var url = ${escaped};
      pdfjsLib.getDocument({ url: url, withCredentials: false }).promise
        .then(function (pdf) {
          statusEl.style.display = 'none';
          var renderPage = function (num) {
            return pdf.getPage(num).then(function (page) {
              var scale = 1.4;
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement('canvas');
              var ctx = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              viewer.appendChild(canvas);
              return page.render({ canvasContext: ctx, viewport: viewport }).promise;
            });
          };
          var chain = Promise.resolve();
          for (var i = 1; i <= pdf.numPages; i++) {
            (function (n) { chain = chain.then(function () { return renderPage(n); }); })(i);
          }
          return chain;
        })
        .catch(function (err) {
          statusEl.style.display = 'block';
          statusEl.textContent = 'No se pudo mostrar el PDF. ' + (err && err.message ? err.message : '');
        });
    })();
  </script>
</body>
</html>`;
}

export function DocumentViewerModal({
  visible,
  onClose,
  uri,
  fileName = 'Documento',
  mimeType,
  localUri,
}: Props) {
  const insets = useSafeAreaInsets();
  const image = isImageMime(mimeType, fileName);
  const pdf = isPdfMime(mimeType, fileName);
  const [pdfSource, setPdfSource] = useState<string | null>(null);
  const [preparingPdf, setPreparingPdf] = useState(false);

  // Preferir HTTP para PDF.js; si solo hay file://, convertir a data URI base64.
  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (!visible || !pdf) {
        setPdfSource(null);
        return;
      }

      const remote = uri && (uri.startsWith('http://') || uri.startsWith('https://')) ? uri : null;
      if (remote) {
        setPdfSource(remote);
        return;
      }

      const local = localUri || (uri?.startsWith('file://') ? uri : null);
      if (!local) {
        setPdfSource(null);
        return;
      }

      try {
        setPreparingPdf(true);
        const base64 = await FileSystem.readAsStringAsync(local, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!cancelled) {
          setPdfSource(`data:application/pdf;base64,${base64}`);
        }
      } catch (e) {
        console.warn('Failed to prepare local PDF for viewer:', e);
        if (!cancelled) setPdfSource(null);
      } finally {
        if (!cancelled) setPreparingPdf(false);
      }
    };

    prepare();
    return () => {
      cancelled = true;
    };
  }, [visible, pdf, uri, localUri]);

  const pdfHtml = useMemo(() => {
    if (!pdf || !pdfSource) return null;
    return buildPdfHtml(pdfSource);
  }, [pdf, pdfSource]);

  const imageUri = uri || localUri;

  const handleShare = async () => {
    const shareUri = localUri || uri;
    if (!shareUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: mimeType || undefined,
          dialogTitle: fileName,
          UTI: mimeType || undefined,
        });
      }
    } catch (e) {
      console.warn('Share document failed:', e);
    }
  };

  const handleOpenExternal = async () => {
    try {
      if (Platform.OS === 'android' && localUri?.startsWith('file://')) {
        const contentUri = await FileSystem.getContentUriAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: mimeType || '*/*',
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
        return;
      }

      if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        await Linking.openURL(uri);
        return;
      }

      if (localUri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(localUri, {
          mimeType: mimeType || undefined,
          dialogTitle: fileName,
          UTI: mimeType || undefined,
        });
        return;
      }

      Alert.alert('Error', 'No se pudo abrir el archivo con otra aplicación.');
    } catch (e) {
      console.warn('Open external failed:', e);
      Alert.alert('Error', 'No se pudo abrir el archivo con otra aplicación.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={10}>
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{fileName}</Text>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} hitSlop={10}>
            <Ionicons name="share-outline" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {!imageUri && !pdfSource ? (
            <ActivityIndicator color="#FFF" size="large" />
          ) : image && imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
          ) : pdf && (preparingPdf || !pdfHtml) ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#4CAF50" size="large" />
              <Text style={styles.loadingText}>Preparando documento…</Text>
            </View>
          ) : pdf && pdfHtml ? (
            <WebView
              originWhitelist={['*']}
              source={{ html: pdfHtml, baseUrl: Platform.OS === 'android' ? '' : undefined }}
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator color="#4CAF50" size="large" />
                </View>
              )}
              allowFileAccess
              allowUniversalAccessFromFileURLs
              mixedContentMode="always"
              javaScriptEnabled
              domStorageEnabled
            />
          ) : (
            <View style={styles.fallback}>
              <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
              <Text style={styles.fallbackTitle}>{fileName}</Text>
              <Text style={styles.fallbackSub}>
                Vista previa no disponible para este tipo de archivo.
              </Text>
              <TouchableOpacity style={styles.externalBtn} onPress={handleOpenExternal}>
                <Text style={styles.externalBtnText}>Abrir con otra app</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    backgroundColor: '#111',
  },
  image: {
    flex: 1,
    width: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1f1f1f',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    gap: 12,
  },
  loadingText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  fallbackTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  fallbackSub: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  externalBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  externalBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
