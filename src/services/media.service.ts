import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';

export interface MediaFile {
    uri: string;
    type: 'image' | 'video';
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    fileName?: string;
}

class MediaService {
    private BUCKET_NAME = 'temp-media';

    /**
     * Pick an image or video from the device gallery
     */
    async pickMedia(): Promise<MediaFile | null> {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            alert('Se requiere acceso a la galería para enviar fotos.');
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, // Start with images only for now
            allowsEditing: true, // Allow cropping/editing
            quality: 0.8, // Good balance for chat
            base64: true, // Need base64 for Supabase upload
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            return {
                uri: asset.uri,
                type: 'image', // simplified for now
                width: asset.width,
                height: asset.height,
                fileSize: asset.fileSize,
                mimeType: asset.mimeType,
                fileName: asset.fileName || `photo_${Date.now()}.jpg`
            };
        }

        return null; // User cancelled
    }

    /**
     * Upload media to Supabase Storage (temp-media bucket)
     * Returns the Storage Key (path)
     */
    async uploadMedia(localUri: string): Promise<string> {
        // 1. Read file as Base64
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // 2. Generate unique filename
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
        const filePath = `uploads/${fileName}`;

        // 3. Upload to Supabase
        const { data, error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .upload(filePath, decode(base64), {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (error) {
            console.error('Supabase Upload Error:', error);
            throw error;
        }

        return data.path; // Store this in the message content
    }

    /**
     * Download media from Supabase Storage to local file system
     * Returns the local URI
     */
    async downloadMedia(storageKey: string): Promise<string> {
        // 1. Check if file already exists locally
        const filename = storageKey.split('/').pop();
        const localUri = `${FileSystem.documentDirectory}${filename}`;

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
            return localUri;
        }

        // 2. Download from Supabase
        const { data, error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .download(storageKey);

        if (error) throw error;

        // 3. Convert Blob to Base64 (needed for FileSystem.writeAsStringAsync in Expo)
        const fr = new FileReader();
        return new Promise((resolve, reject) => {
            fr.onload = async () => {
                const base64 = (fr.result as string).split(',')[1];
                await FileSystem.writeAsStringAsync(localUri, base64, {
                    encoding: FileSystem.EncodingType.Base64
                });
                resolve(localUri);
            };
            fr.onerror = reject;
            fr.readAsDataURL(data);
        });
    }

    /**
     * Delete media from Supabase Storage (Cleanup)
     */
    async deleteMedia(storageKey: string): Promise<void> {
        const { error } = await supabase.storage
            .from(this.BUCKET_NAME)
            .remove([storageKey]);

        if (error) console.error('Delete Error:', error);
    }
}

export const mediaService = new MediaService();
