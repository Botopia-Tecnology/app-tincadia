import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

export const emergencyService = {
    /**
     * Request TTS audio generation for emergency
     * Returns a URL/path to the audio file
     */
    generateAudio: async (emergencyType: string, location: string, language: string = 'es'): Promise<{ url: string; path: string }> => {
        try {
            const response = await apiClient<{ url: string; path: string }>(API_ENDPOINTS.EMERGENCY_AUDIO, {
                method: 'POST',
                body: JSON.stringify({
                    emergencyType,
                    location,
                    language
                })
            });
            return response;
        } catch (error) {
            console.error('Error generating emergency audio:', error);
            throw error;
        }
    }
};
