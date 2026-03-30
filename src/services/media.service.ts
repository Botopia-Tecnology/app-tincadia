import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import { API_URL, API_ENDPOINTS } from '../config/api.config';
import { authService } from './auth.service';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // Increased to 50MB for videos

export interface MediaFile {
    uri: string;
    type: 'image' | 'video' | 'audio';
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    fileName?: string;
    duration?: number;
    base64?: string;
}

export interface UploadResponse {
    public_id: string;
    url: string; // The raw Cloudinary URL (public or private)
    resource_type: string;
    format: string;
}

class MediaService {
    private recording: Audio.Recording | null = null;

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
     * Record a video using the camera
     */
    async recordVideo(): Promise<MediaFile | null> {
        // Request camera permissions
        const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraPermission.granted === false) {
            Alert.alert('Permiso requerido', 'Se requiere acceso a la cámara para grabar video.');
            return null;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.8,
            videoMaxDuration: 60, // 1 minute max
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
     * Upload media to Cloudinary via API Gateway
     * Returns the Public ID (essential for signed URLs) and Type
     */
    async uploadMedia(media: MediaFile): Promise<{ publicId: string; type: string; url: string }> {
        try {
            const token = await authService.getToken();
            if (!token) throw new Error('No authenticated');

            const uploadUrl = API_URL + API_ENDPOINTS.UPLOAD_CHAT_MEDIA;

            // Prepare type field
            // Note: Cloudinary 'raw' is used for generic files, but for audio we often use 'video' or 'raw'
            // We'll stick to 'image' | 'video' | 'raw' as defined in backend
            let uploadType = media.type === 'audio' ? 'raw' : media.type;

            console.log(`📤 Uploading ${media.type} to ${uploadUrl}`);

            const response = await FileSystem.uploadAsync(uploadUrl, media.uri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                parameters: {
                    type: uploadType
                }
            });

            if (response.status !== 201 && response.status !== 200) {
                console.error('Upload failed with status:', response.status, response.body);
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data: UploadResponse = JSON.parse(response.body);
            console.log('✅ Upload success:', data.public_id, 'URL:', data.url);

            return {
                publicId: data.public_id,
                type: media.type,
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
     * Download media to local file system with persistent caching
     * @param storageKeyOrUrl - The public ID or URL of the media
     * @param mediaType - The type of media ('image' | 'video' | 'audio') to determine resource type
     */
    async downloadMedia(storageKeyOrUrl: string, mediaType?: 'image' | 'video' | 'audio'): Promise<string | null> {
        try {
            if (!storageKeyOrUrl) return null;

            // 1. Generate a consistent filename for caching
            // We use the storageKeyOrUrl itself to create a unique but predictable filename
            // Sanitizing to remove special characters that might break file systems
            const safeFilename = storageKeyOrUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const extension = mediaType === 'video' ? 'mp4' : (mediaType === 'audio' ? 'm4a' : 'jpg');
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
                try {
                    const token = await authService.getToken();
                    let resourceType: 'image' | 'video' | 'raw' = 'image';
                    if (mediaType === 'audio') resourceType = 'raw';
                    else if (mediaType === 'video') resourceType = 'video';

                    const response = await fetch(API_URL + API_ENDPOINTS.GET_SIGNED_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ publicId: storageKeyOrUrl, resourceType })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.url) {
                            urlToDownload = data.url;
                        }
                    }
                } catch (e) {
                    console.error('Error fetching signed URL:', e);
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
}

export const mediaService = new MediaService();
