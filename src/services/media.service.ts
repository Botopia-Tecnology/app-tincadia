import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { API_URL, API_ENDPOINTS } from '../config/api.config';
import { authService } from './auth.service';

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
            allowsEditing: false, // Don't force editing for videos
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
            allowsEditing: false,
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
     * Returns the Public ID (essential for signed URLs) and Type
     */
    async uploadMedia(media: MediaFile): Promise<{ publicId: string; type: string; url: string }> {
        try {
            const token = await authService.getToken();
            if (!token) throw new Error('No authenticated');

            const preparedMedia = await this.prepareMediaForUpload(media);

            const uploadUrl = API_URL + API_ENDPOINTS.UPLOAD_CHAT_MEDIA;

            // Prepare type field
            // Note: Cloudinary 'raw' is used for generic files, but for audio we often use 'video' or 'raw'
            // We'll stick to 'image' | 'video' | 'raw' as defined in backend
            let uploadType = (preparedMedia.type === 'audio' || preparedMedia.type === 'document') ? 'raw' : preparedMedia.type;

            console.log(`📤 Uploading ${preparedMedia.type} to ${uploadUrl}`);

            const response = await FileSystem.uploadAsync(uploadUrl, preparedMedia.uri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                parameters: {
                    type: uploadType,
                    // Nombre original con extensión (el URI local suele ser un cache sin extensión útil)
                    fileName: preparedMedia.fileName || `file_${Date.now()}`,
                },
            });

            if (response.status !== 201 && response.status !== 200) {
                console.error('Upload failed with status:', response.status, response.body);
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data: UploadResponse = JSON.parse(response.body);
            console.log('✅ Upload success:', data.public_id, 'URL:', data.url);

            return {
                publicId: data.public_id,
                type: preparedMedia.type,
                url: data.url // Return full Cloudinary URL for direct playback
            };

        } catch (error) {
            console.error('Media upload error:', error);
            throw error;
        }
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

            const token = await authService.getToken();
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

            const response = await fetch(API_URL + API_ENDPOINTS.GET_SIGNED_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ publicId, resourceType })
            });

            if (response.ok) {
                const data = await response.json();
                return data.url || null;
            }
        } catch (e) {
            console.error('Error fetching signed URL:', e);
        }
        return null;
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

            // 1. Generate a consistent filename for caching
            const safeFilename = storageKeyOrUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            let extension = 'bin';
            if (mediaType === 'video') extension = 'mp4';
            else if (mediaType === 'audio') extension = 'm4a';
            else if (mediaType === 'image') extension = 'jpg';
            else if (mediaType === 'document') {
                const fromKey = storageKeyOrUrl.match(/\.([a-z0-9]{1,8})$/i);
                extension = fromKey ? fromKey[1] : 'bin';
            }
            extension = extensionFromMimeType(options.mimeType) || extension;
            const fileUri = `${FileSystem.documentDirectory}${safeFilename}.${extension}`;

            // 2. Check if file already exists in persistent storage
            const fileInfo = await FileSystem.getInfoAsync(fileUri);
            if (fileInfo.exists) {
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

            // 4. Download the file to persistent storage
            console.log(`📡 [MediaService] Downloading media to cache: ${urlToDownload}`);
            const { uri } = await FileSystem.downloadAsync(urlToDownload, fileUri);
            return uri;

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
