import AsyncStorage from '@react-native-async-storage/async-storage';

export const syncCacheService = {
  /**
   * Helper to remove a user from the synced contacts list (AsyncStorage)
   * This should be called when a contact is added or permanently deleted
   */
  async removeFromSyncedCache(userId: string, otherUserIdToRemove: string) {
    if (!userId || !otherUserIdToRemove) return;
    
    const SYNCED_CONTACTS_KEY = `@synced_contacts_${userId}`;
    try {
      const stored = await AsyncStorage.getItem(SYNCED_CONTACTS_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          const filtered = list.filter((item: any) => 
            (item.otherUserId !== otherUserIdToRemove) && 
            (item.id !== `synced-${otherUserIdToRemove}`)
          );
          
          if (filtered.length !== list.length) {
            await AsyncStorage.setItem(SYNCED_CONTACTS_KEY, JSON.stringify(filtered));
            console.log(`🧹 Cache cleaned (service): removed ${otherUserIdToRemove}`);
            return true;
          }
        }
      }
    } catch (err) {
      console.error('Error cleaning synced cache:', err);
    }
    return false;
  }
};
