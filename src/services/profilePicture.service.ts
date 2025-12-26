/**
 * Profile Picture Service
 * 
 * Handles uploading profile pictures to the backend.
 * Uses direct fetch instead of apiClient to handle FormData correctly.
 */

import { Platform } from 'react-native';
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

        const formData = new FormData();

        // React Native specific FormData structure
        const filename = imageUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('file', {
            uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
            name: filename,
            type,
        } as any);

        try {
            const endpoint = API_ENDPOINTS.UPLOAD_AVATAR(userId);
            // Ensure API_URL doesn't double slash if endpoint starts with /
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            const fullUrl = `${baseUrl}${endpoint}`;

            console.log('Uploading to:', fullUrl);

            const response = await fetch(fullUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Content-Type is handled automatically by FormData (multipart/form-data; boundary=...)
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Upload failed with status ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            throw error;
        }
    }
};
