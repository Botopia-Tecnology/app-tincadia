import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { API_URL, API_ENDPOINTS } from '../config/api.config';
import { authService } from './auth.service';
import { apiClient } from '../lib/api-client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB for videos

type CloudinaryResourceType = 'image' | 'video' | 'raw';

interface DownloadMediaOptions {
    mimeType?: string;
    resourceType?: CloudinaryResourceType;
}

function extensionFromMimeType(mimeType?: string): string | undefined {
    if (!mimeType) return undefined;
    const extensions: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/heic': 'heic',
        'video/mp4': 'mp4',
        'audio/m4a': 'm4a',
        'application/pdf': 'pdf',
    };
    return extensions[mimeType.toLowerCase()];
}

export interface MediaFile {
    uri: string;
    type: 'image' | 'video' | 'audio' | 'document';
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    fileName?: string;
    duration?: number;
    base64?: string;
    /** URI points to a verified local copy ready for upload/render. */
    uploadReady?: boolean;
}

export interface UploadResponse {
    public_id: string;
    url: string; // The raw Cloudinary URL (public or private)
    resource_type: string;
    format: string;
}

class MediaService {
    private recording: Audio.Recording | null = null;
    private signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
    private inFlightSignedUrls = new Map<string, Promise<string | null>>();

    /**
     * Compute a deterministic local cache URI in documentDirectory for a given key/publicId
     */
    getCacheFileUri(
        storageKeyOrUrl: string,
        mediaType?: 'image' | 'video' | 'audio' | 'document',
        optionsOrMime?: DownloadMediaOptions | string,
    ): string {
        const safeFilename = storageKeyOrUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        let extension = 'bin';
        if (mediaType === 'video') extension = 'mp4';
        else if (mediaType === 'audio') extension = 'm4a';
        else if (mediaType === 'image') extension = 'jpg';
        else if (mediaType === 'document') {
            const fromKey = storageKeyOrUrl.match(/\.([a-z0-9]{1,8})$/i);
            extension = fromKey ? fromKey[1] : 'bin';
        }

        const mime = typeof optionsOrMime === 'string' ? optionsOrMime : optionsOrMime?.mimeType;
        if (mime) {
            const fromMime = extensionFromMimeType(mime);
            if (fromMime) {
                extension = fromMime;
            } else {
                const fromName = mime.match(/\.([a-z0-9]{1,8})$/i);
                if (fromName) extension = fromName[1];
            }
        }
        return `${FileSystem.documentDirectory}${safeFilename}.${extension}`;
    }

    /** Wait until a camera/provider URI exists and its size is stable. */
    async ensureLocalMediaReady(uri: string, attempts = 20, delayMs = 100): Promise<string> {
        if (!uri || !uri.startsWith('file://')) return uri;

        let previousSize = -1;
        let stableReads = 0;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            const info = await FileSystem.getInfoAsync(uri);
            const size = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : 0;
            if (size > 0) {
                stableReads = size === previousSize ? stableReads + 1 : 0;
                previousSize = size;
                // Two equal reads prevent uploading a partially written camera file.
                if (stableReads >= 1) return uri;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        throw new Error('El archivo multimedia todavía no está disponible.');
    }

    /**
     * Materialize the picker/camera URI into a unique cache file. The same
     * stable URI is then used by both the optimistic preview and the upload.
     */
    async prepareMediaForUpload(media: MediaFile): Promise<MediaFile> {
        if (media.uploadReady || !media.uri.startsWith('file://')) return media;

        const sourceUri = await this.ensureLocalMediaReady(media.uri);
        const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        if (!directory) throw new Error('No hay almacenamiento local disponible.');

        const extension = media.fileName?.match(/\.([a-z0-9]{1,8})$/i)?.[1]
            || (media.type === 'image' ? 'jpg' : media.type === 'video' ? 'mp4' : media.type === 'audio' ? 'm4a' : 'bin');
        const targetUri = `${directory}chat-upload-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

        await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
        await this.ensureLocalMediaReady(targetUri);

        return { ...media, uri: targetUri, uploadReady: true };
    }

    /**
     * Pick an image or video from the device gallery
     */
    async pickMedia(): Promise<MediaFile | null> {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert('Permiso requerido', 'Se requiere acceso a la galería para enviar fotos y videos.');
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All, // Images and Videos
            // Android/iOS show the native crop editor for images and leave
            // videos unchanged. The user confirms the crop before upload.
            allowsEditing: true,
            quality: 0.8,
            base64: false, // We don't need base64 for file upload
            videoMaxDuration: 60, // 1 minute max for videos
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];

            // Check file size if available (native often provides it)
            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                Alert.alert('Archivo muy grande', 'El archivo debe ser menor a 50MB.');
                return null;
            }

            // Determine type from asset type or mimeType
            let type: 'image' | 'video' = 'image';
            if (asset.type === 'video' || asset.mimeType?.startsWith('video/')) {
                type = 'video';
            }

            return {
                uri: asset.uri,
                type,
                width: asset.width,
                height: asset.height,
                fileSize: asset.fileSize,
                mimeType: asset.mimeType,
                fileName: asset.fileName || `media_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`,
                duration: asset.duration ?? undefined,
            };
        }

        return null; // User cancelled
    }

    /**
     * Pick a document (PDF, etc.)
     */
    async pickDocument(): Promise<MediaFile | null> {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return null;
            }

            const asset = result.assets[0];

            if (asset.size && asset.size > MAX_FILE_SIZE) {
                Alert.alert('Archivo muy grande', 'El documento debe ser menor a 50MB.');
                return null;
            }

            return {
                uri: asset.uri,
                type: 'document',
                fileSize: asset.size,
                mimeType: asset.mimeType || 'application/octet-stream',
                fileName: asset.name || `doc_${Date.now()}`,
            };
        } catch (error) {
            console.error('Document picker error:', error);
            Alert.alert('Error', 'No se pudo abrir el selector de documentos.');
            return null;
        }
    }


    /**
     * Take a photo using the camera
     */
    async takePhoto(): Promise<MediaFile | null> {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.granted === false) {
            Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para tomar fotos.');
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            // Open the native crop editor after taking the photo.
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];

            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                Alert.alert('Archivo muy grande', 'La foto debe ser menor a 50MB.');
                return null;
            }

            return {
                uri: asset.uri,
                type: 'image',
                width: asset.width,
                height: asset.height,
                fileSize: asset.fileSize,
                mimeType: asset.mimeType || 'image/jpeg',
                fileName: asset.fileName || `photo_${Date.now()}.jpg`,
            };
        }

        return null;
    }

    /**
     * Record a short video using the camera (max 60s)
     */
    async recordVideo(): Promise<MediaFile | null> {
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.granted === false) {
            Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para grabar video.');
            return null;
        }

        const micPermission = await Audio.requestPermissionsAsync();
        if (micPermission.status !== 'granted') {
            Alert.alert('Permiso requerido', 'Se requiere acceso al micrófono para grabar video con audio.');
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.8,
            videoMaxDuration: 60, // short videos, 1 minute max
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];

            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                Alert.alert('Video muy grande', 'El video debe ser menor a 50MB.');
                return null;
            }

            return {
                uri: asset.uri,
                type: 'video',
                width: asset.width,
                height: asset.height,
                fileSize: asset.fileSize,
                mimeType: asset.mimeType || 'video/mp4',
                fileName: asset.fileName || `video_${Date.now()}.mp4`,
                duration: asset.duration ?? undefined,
            };
        }

        return null;
    }

    /**
     * Send video to the video-to-text translation endpoint
     * Returns the translated text
     */
    async videoToText(videoUri: string): Promise<string | null> {
        try {
            const token = await authService.getToken();
            if (!token) throw new Error('No authenticated');

            const endpoint = `${API_URL}/model/video-to-text`;

            console.log('🎬 Sending video for translation:', videoUri);

            const response = await FileSystem.uploadAsync(endpoint, videoUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log('📝 Video-to-text response:', response.status, response.body);

            if (response.status !== 200 && response.status !== 201) {
                console.error('Video-to-text failed:', response.status, response.body);
                throw new Error(`Translation failed: ${response.status}`);
            }

            const data = JSON.parse(response.body);

            if (data.success && data.text) {
                console.log('✅ Translation result:', data.text);
                return data.text;
            }

            return null;
        } catch (error) {
            console.error('Video-to-text error:', error);
            throw error;
        }
    }

    /**
     * Transcribe a voice note / audio file via Model-ms (Vosk local).
     */
    async audioToText(audioUri: string): Promise<string | null> {
        try {
            const token = await authService.getToken();
            if (!token) throw new Error('No authenticated');

            const endpoint = `${API_URL}/model/audio-to-text`;
            console.log('🎙️ Sending audio for transcription:', audioUri);

            const response = await FileSystem.uploadAsync(endpoint, audioUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log('📝 Audio-to-text response:', response.status, response.body);

            if (response.status !== 200 && response.status !== 201) {
                console.error('Audio-to-text failed:', response.status, response.body);
                throw new Error(`Transcription failed: ${response.status}`);
            }

            const data = JSON.parse(response.body);
            if (data.success && typeof data.text === 'string') {
                return data.text.trim() || null;
            }

            return null;
        } catch (error) {
            console.error('Audio-to-text error:', error);
            throw error;
        }
    }

    /**
     * Upload media to Cloudinary via API Gateway
     * Returns the Public ID (essential for signed URLs) and Type.
     * Includes timeout (60s images, 180s video/audio) and automatic retries (3 attempts with exponential backoff).
     */
    async uploadMedia(media: MediaFile): Promise<{ publicId: string; type: string; url: string; localUri: string }> {
        const MAX_RETRIES = 3;
        const BASE_DELAY_MS = 2000;
        const TIMEOUT_IMAGE_MS = 60_000;
        const TIMEOUT_VIDEO_MS = 180_000;

        const preparedMedia = await this.prepareMediaForUpload(media);
        const isHeavy = preparedMedia.type === 'video' || preparedMedia.type === 'audio';
        const timeoutMs = isHeavy ? TIMEOUT_VIDEO_MS : TIMEOUT_IMAGE_MS;

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const token = await authService.getToken();
                if (!token) throw new Error('No authenticated');

                const uploadUrl = API_URL + API_ENDPOINTS.UPLOAD_CHAT_MEDIA;
                let uploadType = (preparedMedia.type === 'audio' || preparedMedia.type === 'document') ? 'raw' : preparedMedia.type;

                console.log(`📤 [Upload] Attempt ${attempt}/${MAX_RETRIES} — ${preparedMedia.type} to ${uploadUrl}`);

                // Race the upload against a timeout
                const uploadPromise = FileSystem.uploadAsync(uploadUrl, preparedMedia.uri, {
                    httpMethod: 'POST',
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    fieldName: 'file',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    parameters: {
                        type: uploadType,
                        fileName: preparedMedia.fileName || `file_${Date.now()}`,
                    },
                });

                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                const timeoutPromise = new Promise<never>((_resolve, reject) => {
                    timeoutId = setTimeout(() => reject(new Error(`Upload timed out after ${timeoutMs / 1000}s`)), timeoutMs);
                });

                let response: FileSystem.FileSystemUploadResult;
                try {
                    response = await Promise.race([uploadPromise, timeoutPromise]);
                } finally {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                    }
                }

                if (response.status !== 201 && response.status !== 200) {
                    console.error(`[Upload] Failed with status ${response.status}:`, response.body);
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const data: UploadResponse = JSON.parse(response.body);
                console.log(`✅ [Upload] Success on attempt ${attempt}:`, data.public_id);

                // Pre-cache the uploaded media locally into persistent cache using the publicId
                // so downloadMedia will immediately find it without re-downloading from Cloudinary!
                try {
                    const persistentCacheUri = this.getCacheFileUri(data.public_id, preparedMedia.type, preparedMedia.fileName);
                    await FileSystem.copyAsync({
                        from: preparedMedia.uri,
                        to: persistentCacheUri,
                    });
                    console.log(`📦 [MediaService] Pre-cached uploaded media: ${persistentCacheUri}`);
                } catch (cacheErr) {
                    console.warn('⚠️ [MediaService] Could not pre-cache uploaded file:', cacheErr);
                }

                // Also cache the Cloudinary URL in signedUrlCache if present
                if (data.url) {
                    this.signedUrlCache.set(data.public_id, {
                        url: data.url,
                        expiresAt: Date.now() + 50 * 60 * 1000,
                    });
                }

                return {
                    publicId: data.public_id,
                    type: preparedMedia.type,
                    url: data.url,
                    localUri: preparedMedia.uri,
                };

            } catch (error: any) {
                lastError = error;
                console.warn(`⚠️ [Upload] Attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

                if (attempt < MAX_RETRIES) {
                    const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2s, 4s, 8s
                    console.log(`⏳ [Upload] Retrying in ${delayMs / 1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }

        console.error(`❌ [Upload] All ${MAX_RETRIES} attempts failed for ${preparedMedia.type}`);
        throw lastError || new Error('Upload failed after all retries');
    }

    /**
     * Start recording audio
     */
    async startRecording(): Promise<boolean> {
        try {
            // Request permissions
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permiso requerido', 'Se requiere acceso al micrófono para grabar audio.');
                return false;
            }

            // Configure audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Start recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            this.recording = recording;
            console.log('🎙️ Recording started');
            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    /**
     * Stop recording and return the audio file
     */
    async stopRecording(): Promise<MediaFile | null> {
        if (!this.recording) {
            return null;
        }

        try {
            await this.recording.stopAndUnloadAsync();
            const uri = this.recording.getURI();
            this.recording = null;

            // Reset audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            if (!uri) return null;

            // Get file info
            const fileInfo = await FileSystem.getInfoAsync(uri);

            console.log('🎙️ Recording stopped:', uri);

            return {
                uri,
                type: 'audio',
                fileSize: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined,
                mimeType: 'audio/m4a',
                fileName: `audio_${Date.now()}.m4a`,
            };
        } catch (error) {
            console.error('Failed to stop recording:', error);
            this.recording = null;
            return null;
        }
    }

    /**
     * Cancel current recording
     */
    async cancelRecording(): Promise<void> {
        if (this.recording) {
            try {
                await this.recording.stopAndUnloadAsync();
            } catch { }
            this.recording = null;
        }
    }

    /**
     * Check if currently recording
     */
    isRecording(): boolean {
        return this.recording !== null;
    }
    /**
     * Get signed Cloudinary URL for media or documents
     */
    async getSignedUrl(
        publicId: string,
        mediaType: 'image' | 'video' | 'audio' | 'document' | 'file' = 'image',
        resourceTypeOverride?: CloudinaryResourceType,
    ): Promise<string | null> {
        try {
            if (!publicId) return null;
            if (publicId.startsWith('http://') || publicId.startsWith('https://')) return publicId;

            let resourceType: CloudinaryResourceType = resourceTypeOverride || 'raw';
            if (!resourceTypeOverride) {
                if (mediaType === 'image') resourceType = 'image';
                else if (mediaType === 'video') resourceType = 'video';
                else if (mediaType === 'audio' || mediaType === 'document' || mediaType === 'file') resourceType = 'raw';
            }

            const lower = publicId.toLowerCase();
            if (!resourceTypeOverride && (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp'))) {
                resourceType = 'image';
            }

            const cacheKey = `${publicId}:${resourceType}`;
            const cached = this.signedUrlCache.get(cacheKey) || this.signedUrlCache.get(publicId);
            if (cached && cached.expiresAt > Date.now() + 60000) {
                return cached.url;
            }

            // Deduplicate concurrent in-flight requests for the same publicId
            if (this.inFlightSignedUrls.has(cacheKey)) {
                return await this.inFlightSignedUrls.get(cacheKey)!;
            }

            const fetchTask = (async (): Promise<string | null> => {
                let delayMs = 400;
                const maxRetries = 2;
                for (let attempt = 0; attempt <= maxRetries; attempt++) {
                    try {
                        const data = await apiClient<{ url: string }>(API_ENDPOINTS.GET_SIGNED_URL, {
                            method: 'POST',
                            body: JSON.stringify({ publicId, resourceType }),
                            suppressUnauthorizedHandling: true,
                        });

                        if (data && data.url) {
                            this.signedUrlCache.set(cacheKey, {
                                url: data.url,
                                expiresAt: Date.now() + 50 * 60 * 1000,
                            });
                            return data.url;
                        }
                    } catch (e) {
                        if (attempt < maxRetries) {
                            console.warn(`[MediaService] getSignedUrl attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`);
                            await new Promise(res => setTimeout(res, delayMs));
                            delayMs *= 2;
                        } else {
                            console.error('[MediaService] Error fetching signed URL after retries:', e);
                        }
                    }
                }
                return null;
            })();

            this.inFlightSignedUrls.set(cacheKey, fetchTask);
            try {
                return await fetchTask;
            } finally {
                this.inFlightSignedUrls.delete(cacheKey);
            }
        } catch (e) {
            console.error('Error in getSignedUrl:', e);
            return null;
        }
    }

    /**
     * Download media to local file system with persistent caching
     * @param storageKeyOrUrl - The public ID or URL of the media
     * @param mediaType - The type of media ('image' | 'video' | 'audio' | 'document') to determine resource type
     */
    async downloadMedia(
        storageKeyOrUrl: string,
        mediaType?: 'image' | 'video' | 'audio' | 'document',
        options: DownloadMediaOptions = {},
    ): Promise<string | null> {
        try {
            if (!storageKeyOrUrl) return null;

            // 1. Generate consistent filename for caching
            const fileUri = this.getCacheFileUri(storageKeyOrUrl, mediaType, options);

            // 2. Check if file already exists in persistent storage
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number' && fileInfo.size > 0) {
                console.log(`📦 [MediaService] Using cached media: ${fileUri}`);
                return fileUri;
            }

            let urlToDownload = storageKeyOrUrl;

            // 3. If it's not a URL (doesn't start with http), it's a storage key (Public ID)
            if (!storageKeyOrUrl.startsWith('http')) {
                console.log(`🔑 [MediaService] Fetching signed URL for key: ${storageKeyOrUrl}`);
                const signedUrl = await this.getSignedUrl(storageKeyOrUrl, mediaType, options.resourceType);
                if (signedUrl) {
                    urlToDownload = signedUrl;
                }
            }

            // If we still don't have a valid URL to download, fail
            if (!urlToDownload.startsWith('http')) {
                console.warn('⚠️ [MediaService] No valid URL to download after processing');
                return null;
            }

            // 4. Download to a temporary file first so a partial transfer is
            // never exposed as a valid image in the chat cache.
            console.log(`📡 [MediaService] Downloading media to cache: ${urlToDownload}`);
            const temporaryUri = `${fileUri}.part-${Date.now()}`;
            await FileSystem.deleteAsync(temporaryUri, { idempotent: true });
            const { uri: downloadedUri } = await FileSystem.downloadAsync(urlToDownload, temporaryUri);
            await this.ensureLocalMediaReady(downloadedUri);
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            await FileSystem.moveAsync({ from: downloadedUri, to: fileUri });
            return fileUri;

        } catch (error) {
            console.error('Download media error:', error);
            return null;
        }
    }

    /**
     * Save an image to the device gallery. Remote media is downloaded first so
     * MediaLibrary always receives a complete local file URI.
     */
    async saveImageToGallery(uri: string): Promise<void> {
        if (!uri) throw new Error('No hay una imagen para guardar.');

        const permission = await MediaLibrary.requestPermissionsAsync();
        if (!permission.granted) {
            throw new Error('Se requiere permiso para guardar imágenes en la galería.');
        }

        let localUri = uri;
        if (!uri.startsWith('file://')) {
            const downloaded = await this.downloadMedia(uri, 'image', { mimeType: 'image/jpeg' });
            if (!downloaded) throw new Error('No se pudo descargar la imagen.');
            localUri = downloaded;
        }

        const info = await FileSystem.getInfoAsync(localUri);
        if (!info.exists || !('size' in info) || !info.size || info.size <= 0) {
            throw new Error('La imagen todavía no está disponible completamente.');
        }

        await MediaLibrary.createAssetAsync(localUri);
    }
}

export const mediaService = new MediaService();
