import * as FileSystem from 'expo-file-system/legacy'; // Ensure legacy import matches media.service if needed, or standard
import { tokenStorage } from '../lib/secure-storage';
import { API_URL, API_ENDPOINTS } from '../config/api.config';

export const profilePictureService = {
    /**
     * Upload profile picture
     * @param userId - User ID
     * @param imageUri - Local URI of the image (from picker)
     */
    async uploadProfilePicture(userId: string, imageUri: string): Promise<{ avatarUrl: string }> {
        const token = await tokenStorage.getToken();
        if (!token) {
            throw new Error('No authentication token found');
        }

        try {
            const endpoint = API_ENDPOINTS.UPLOAD_AVATAR(userId);
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            const fullUrl = `${baseUrl}${endpoint}`;

            console.log('📤 Uploading avatar to:', fullUrl);

            // Use FileSystem.uploadAsync for better Android support and consistency with Chat logic
            const response = await FileSystem.uploadAsync(fullUrl, imageUri, {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'file',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                // mimetype is usually inferred or can be passed if needed, but uploadAsync handles it well usually.
                // If strict mimeType needed, we can check file extension.
            });

            if (response.status !== 201 && response.status !== 200) {
                console.error('Upload failed with status:', response.status, response.body);
                throw new Error(`Upload failed with status ${response.status}`);
            }

            const data = JSON.parse(response.body);
            return data;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            throw error;
        }
    }
};
