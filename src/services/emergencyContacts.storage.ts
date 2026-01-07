/**
 * Emergency Contacts Storage Service
 * Stores emergency contacts locally using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'emergency_contacts';

export interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
}

export const emergencyContactsStorage = {
    /**
     * Get all emergency contacts
     */
    async getContacts(): Promise<EmergencyContact[]> {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error getting emergency contacts:', error);
            return [];
        }
    },

    /**
     * Save all emergency contacts
     */
    async saveContacts(contacts: EmergencyContact[]): Promise<void> {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
        } catch (error) {
            console.error('Error saving emergency contacts:', error);
            throw error;
        }
    },

    /**
     * Add a new emergency contact
     */
    async addContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
        const contacts = await this.getContacts();
        const newContact: EmergencyContact = {
            ...contact,
            id: Date.now().toString(),
        };
        contacts.push(newContact);
        await this.saveContacts(contacts);
        return newContact;
    },

    /**
     * Remove an emergency contact by ID
     */
    async removeContact(id: string): Promise<void> {
        const contacts = await this.getContacts();
        const filtered = contacts.filter(c => c.id !== id);
        await this.saveContacts(filtered);
    },

    /**
     * Update an emergency contact
     */
    async updateContact(id: string, updates: Partial<EmergencyContact>): Promise<void> {
        const contacts = await this.getContacts();
        const index = contacts.findIndex(c => c.id === id);
        if (index !== -1) {
            contacts[index] = { ...contacts[index], ...updates };
            await this.saveContacts(contacts);
        }
    },
};
