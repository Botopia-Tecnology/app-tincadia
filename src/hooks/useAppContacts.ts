import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contactService, Contact } from '../services/contact.service';
import { getLocalContacts, saveContact } from '../database/chatDatabase';

const LAST_SYNC_KEY = 'tincadia_contacts_last_sync_';

// Map SQLite cached contact to Service Contact
const mapLocalToService = (local: any): Contact => ({
    id: local.id,
    ownerId: local.owner_id,
    contactUserId: local.contact_user_id,
    phone: local.phone,
    alias: local.alias || undefined,
    customFirstName: local.custom_first_name || undefined,
    customLastName: local.custom_last_name || undefined,
    createdAt: local.updated_at || new Date().toISOString(),
});

export function useAppContacts(userId: string) {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // Initial Load from SQLite
    const loadFromCache = useCallback(() => {
        try {
            const local = getLocalContacts(userId);
            if (local.length > 0) {
                const mapped = local.map(mapLocalToService);
                setContacts(mapped);
                return true;
            }
        } catch (e) {
            console.error('Failed to load contacts from SQLite', e);
        }
        return false;
    }, [userId]);

    const syncContacts = useCallback(async () => {
        if (!userId) return;
        setIsSyncing(true);
        try {
            // 1. Get last sync time
            // 1. Get last sync time
            let lastSync = await AsyncStorage.getItem(`${LAST_SYNC_KEY}${userId}`);

            // Force full sync if local cache is empty
            // This handles cases where data was wiped but AsyncStorage key persisted,
            // or if the user claims to have contacts but they aren't showing.
            const localCheck = getLocalContacts(userId);
            if (localCheck.length === 0) {
                console.log('⚠️ Local cache empty, forcing full contact sync');
                lastSync = null;
            }

            // 2. Fetch delta (updates since lastSync)
            console.log(`[Contacts] Syncing since: ${lastSync || 'ALL'}`);
            const response = await contactService.getContacts(userId, lastSync || undefined);
            const newContacts = response.contacts || [];

            if (newContacts.length > 0) {
                console.log(`[Contacts] Received ${newContacts.length} updates`);

                // 3. Save to SQLite
                newContacts.forEach(c => {
                    saveContact({
                        id: c.id,
                        ownerId: c.ownerId || userId,
                        contactUserId: c.contactUserId,
                        phone: c.phone,
                        alias: c.alias,
                        customFirstName: c.customFirstName,
                        customLastName: c.customLastName
                    });
                });

                // 4. Reload from SQLite to get consistent sort order and data
                loadFromCache();

                // 5. Update last sync time
                await AsyncStorage.setItem(`${LAST_SYNC_KEY}${userId}`, new Date().toISOString());
            } else {
                console.log('[Contacts] Up to date');
            }
        } catch (error) {
            console.error('Error syncing contacts', error);
        } finally {
            setIsSyncing(false);
            setIsLoading(false);
        }
    }, [userId, loadFromCache]);

    useEffect(() => {
        if (userId) {
            // Load cache immediately
            const hasCache = loadFromCache();
            // If cache exists, we are done "loading" (UI can show data), but we start sync
            if (hasCache) setIsLoading(false);

            // Start sync
            syncContacts();
        }
    }, [userId, loadFromCache, syncContacts]);

    return {
        contacts,
        isLoading,
        isSyncing,
        refresh: syncContacts
    };
}
