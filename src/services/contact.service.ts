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

// Helper to map snake_case to camelCase since backend may return snake_case for individual records
function mapContactToCamelCase(contact: Record<string, any>): Contact {
    if (!contact) return contact as any;
    return {
        id: contact.id,
        phone: contact.phone,
        ownerId: contact.ownerId || contact.owner_id,
        contactUserId: contact.contactUserId || contact.contact_user_id,
        alias: contact.alias,
        customFirstName: contact.customFirstName || contact.custom_first_name,
        customLastName: contact.customLastName || contact.custom_last_name,
        createdAt: contact.createdAt || contact.created_at,
    };
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
        const response = await apiClient<{ contact: Record<string, any> }>(API_ENDPOINTS.ADD_CONTACT, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        if (response && response.contact) {
            return {
                contact: mapContactToCamelCase(response.contact)
            };
        }
        return response as any;
    },

    /**
     * Update a contact (alias, custom names)
     */
    async updateContact(contactId: string, data: UpdateContactDto): Promise<{ contact: Contact }> {
        const response = await apiClient<{ contact: Record<string, any> }>(API_ENDPOINTS.CONTACT(contactId), {
            method: 'PUT',
            body: JSON.stringify({ ...data, contactId }),
        });
        
        if (response && response.contact) {
            return {
                contact: mapContactToCamelCase(response.contact)
            };
        }
        return response as any;
    },

    /**
     * Delete a contact
     */
    async deleteContact(contactId: string, ownerId: string): Promise<void> {
        let url = API_ENDPOINTS.CONTACT(contactId);
        if (ownerId) {
            url += `?ownerId=${encodeURIComponent(ownerId)}`;
        }
        return apiClient(url, {
            method: 'DELETE',
        });
    },
};
