
import { API_URL, API_ENDPOINTS } from '../config/api.config';
import { authService } from './auth.service';

export interface Course {
    id: string;
    title: string;
    description: string;
    thumbnailUrl?: string; // Optional as per backend entity? Checked frontend interface
    categoryId: string;
    category?: {
        id: string;
        name: string;
    };
    isPublished: boolean;
    instructor?: string; // Not in backend entity explicitly but in UI mock?
    level?: string; // Not in backend entity explicitly
    modules?: any[];
}

export interface Category {
    id: string;
    name: string;
}

// Helper to build URL
const buildUrl = (endpoint: string) => `${API_URL}${endpoint}`;

export const contentService = {
    /**
     * Get all courses
     */
    getAllCourses: async (): Promise<Course[]> => {
        try {
            const token = await authService.getToken();
            const response = await fetch(buildUrl(API_ENDPOINTS.COURSES), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                // Determine if it was a 401 or other error
                const text = await response.text();
                throw new Error(`Failed to fetch courses: ${response.status} ${text}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching courses:', error);
            throw error;
        }
    },

    /**
     * Get all categories
     */
    getCategories: async (): Promise<Category[]> => {
        try {
            const token = await authService.getToken();
            const response = await fetch(buildUrl(API_ENDPOINTS.CATEGORIES), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            if (!response.ok) throw new Error('Failed to fetch categories');
            return await response.json();
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    },
    /**
     * Get course by ID with modules and lessons
     */
    getCourseById: async (id: string): Promise<Course> => {
        try {
            const token = await authService.getToken();
            const url = buildUrl(API_ENDPOINTS.DETAILS.replace(':id', id));
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to fetch course details: ${response.status} ${text}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching course details:', error);
            throw error;
        }
    },
};
