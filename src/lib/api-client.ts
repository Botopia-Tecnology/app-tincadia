/**
 * API Client
 * 
 * Generic fetch wrapper with:
 * - Automatic Authorization header injection
 * - JSON Content-Type headers
 * - 401 handling with token clearing
 */

import { API_URL } from '../config/api.config';
import { tokenStorage, clearAllAuthData } from './secure-storage';

export interface ApiClientOptions extends RequestInit {
    skipAuth?: boolean;
}

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Callback to trigger logout from context
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorizedCallback(callback: () => void): void {
    onUnauthorized = callback;
}

export async function apiClient<T>(
    endpoint: string,
    options: ApiClientOptions = {}
): Promise<T> {
    const { skipAuth = false, ...fetchOptions } = options;

    const headers = new Headers(fetchOptions.headers);
    headers.set('Content-Type', 'application/json');

    if (!skipAuth) {
        const token = await tokenStorage.getToken();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
    }

    const url = `${API_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
        });

        // Handle 401 Unauthorized
        if (response.status === 401 && !skipAuth) {
            await clearAllAuthData();
            if (onUnauthorized) {
                onUnauthorized();
            }
            throw new ApiError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.', 401);
        }

        // Handle other error responses
        if (!response.ok) {
            let errorData: Record<string, unknown> = {};
            try {
                errorData = await response.json();
            } catch {
                // Response body is not JSON
            }
            const message = (errorData.message as string) || (errorData.detail as string) || `La solicitud falló con estado ${response.status}`;
            throw new ApiError(message, response.status, errorData);
        }

        // Handle empty response (e.g., 204 No Content)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return {} as T;
        }

        return response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        // Network error or other fetch failure
        throw new ApiError(
            error instanceof Error ? error.message : 'Error de red',
            0
        );
    }
}
