import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio } from 'expo-av';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import { Alert } from 'react-native';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

class MediaService {
    private BUCKET_NAME = 'temp-media';
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
            base64: true, // Get base64 for upload
            videoMaxDuration: 60, // 1 minute max for videos
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];

            // Check file size
            if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE) {
                Alert.alert('Archivo muy grande', 'El archivo debe ser menor a 5MB.');
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
                base64: asset.base64 ?? undefined,
            };
        }

        return null; // User cancelled
    }

    /**
     * Upload media to Supabase Storage
     * Returns the Storage Key (path)
     */
    async uploadMedia(media: MediaFile): Promise<string> {
        let base64Data: string;

        // Use provided base64 if available, otherwise read from file
        if (media.base64) {
            base64Data = media.base64;
        } else {
            // Fallback: read file as base64
            base64Data = await FileSystem.readAsStringAsync(media.uri, {
                encoding: 'base64' as any, // Use string instead of enum to avoid undefined
            });
        }

        // Determine file extension and content type
        let extension = 'jpg';
        let contentType = 'image/jpeg';

        if (media.type === 'video') {
            extension = 'mp4';
            contentType = 'video/mp4';
        } else if (media.type === 'audio') {
            extension = 'm4a';
            contentType = 'audio/m4a';
        } else if (media.mimeType) {
            contentType = media.mimeType;
            if (media.mimeType.includes('png')) extension = 'png';
            else if (media.mimeType.includes('gif')) extension = 'gif';
            else if (media.mimeType.includes('webp')) extension = 'webp';
        }

        // Generate unique filename
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
        const filePath = `uploads/${fileName}`;

        // Upload to Supabase
        const { data, error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .upload(filePath, decode(base64Data), {
                contentType,
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            throw error;
        }

        return data.path;
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

            // Check size
            if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > MAX_FILE_SIZE) {
                Alert.alert('Audio muy largo', 'El audio debe ser menor a 5MB. Intenta grabar uno más corto.');
                return null;
            }

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
     * Get public URL for media (no download needed if bucket is public)
     */
    async downloadMedia(storageKey: string): Promise<string> {
        // For public buckets, just get the public URL directly
        const { data } = supabase.storage
            .from(this.BUCKET_NAME)
            .getPublicUrl(storageKey);

        if (data?.publicUrl) {
            return data.publicUrl;
        }

        // Fallback: try signed URL if public URL doesn't work
        const { data: signedData, error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .createSignedUrl(storageKey, 3600); // 1 hour expiry

        if (error) {
            console.error('Failed to get media URL:', error);
            throw error;
        }

        return signedData.signedUrl;
    }

    /**
     * Delete media from Supabase Storage
     */
    async deleteMedia(storageKey: string): Promise<void> {
        const { error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .remove([storageKey]);

        if (error) console.error('Delete Error:', error);
    }
}

export const mediaService = new MediaService();
