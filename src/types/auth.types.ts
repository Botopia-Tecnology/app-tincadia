/**
 * Authentication Types
 * 
 * Matches the backend API response format where isProfileComplete
 * is at the response level, NOT inside the user object.
 */

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    documentTypeId?: number;
    documentType?: string;
    documentNumber?: string;
    phone?: string;
    avatarUrl?: string;
    authProvider?: string;
    emailVerified: boolean;
    isProfileComplete?: boolean;
    readReceiptsEnabled?: boolean;
    role?: string;
}

export interface LoginDto {
    email: string;
    password: string;
}

export interface RegisterDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    documentTypeId?: number;
    documentNumber?: string;
    phone?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
    session?: unknown;
    isProfileComplete?: boolean; // At response level, NOT in user!
}

export interface OAuthLoginDto {
    provider: 'google' | 'apple' | 'microsoft';
    idToken: string;
    accessToken?: string;
}

export interface UpdateProfileDto {
    documentTypeId?: number;
    documentNumber?: string;
    phone?: string;
    pushToken?: string;
    readReceiptsEnabled?: boolean;
}

/**
 * Helper function to check if a user's profile is complete.
 * Checks both the explicit flag and required fields as fallback.
 */
export function isProfileComplete(user: User | null): boolean {
    if (!user) return false;

    // If explicit flag exists and is a boolean, use it
    if (typeof user.isProfileComplete === 'boolean') {
        return user.isProfileComplete;
    }

    // Fallback: check required fields (documentTypeId OR documentType)
    return !!(
        (user.documentTypeId || user.documentType) &&
        user.documentNumber &&
        user.phone
    );
}

/**
 * Maps document type abbreviation to backend ID
 */
export const DOCUMENT_TYPE_MAP: Record<string, number> = {
    'T.I': 1,  // Tarjeta de Identidad
    'C.C': 2,  // Cédula de Ciudadanía
    'C.E': 3,  // Cédula de Extranjería
    'PAS': 4,  // Pasaporte
};

export function getDocumentTypeId(documentType: string): number | undefined {
    return DOCUMENT_TYPE_MAP[documentType];
}
