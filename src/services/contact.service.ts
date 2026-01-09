/**
 * Contact Service
 * 
 * Handles contact management - adding, listing, updating, and deleting contacts.
 */

import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

export interface Contact {
    id: string;
    ownerId: string;
    contactUserId: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
    phone: string;
    createdAt: string;
}

export interface AddContactDto {
    ownerId: string;
    phone: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
}

export interface UpdateContactDto {
    ownerId: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
}

export const contactService = {
    /**
     * Get all contacts for a specific user
     */
    async getContacts(userId: string, since?: string): Promise<{ contacts: Contact[] }> {
        let url = API_ENDPOINTS.CONTACTS(userId);
        if (since) {
            url += `?since=${encodeURIComponent(since)}`;
        }
        return apiClient(url, {
            method: 'GET',
        });
    },

    /**
     * Add a new contact by phone number
     */
    async addContact(data: AddContactDto): Promise<{ contact: Contact }> {
        return apiClient(API_ENDPOINTS.ADD_CONTACT, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    /**
     * Update a contact (alias, custom names)
     */
    async updateContact(contactId: string, data: UpdateContactDto): Promise<{ contact: Contact }> {
        return apiClient(API_ENDPOINTS.CONTACT(contactId), {
            method: 'PUT',
            body: JSON.stringify({ ...data, contactId }),
        });
    },

    /**
     * Delete a contact
     */
    async deleteContact(contactId: string): Promise<void> {
        return apiClient(API_ENDPOINTS.CONTACT(contactId), {
            method: 'DELETE',
        });
    },
};
