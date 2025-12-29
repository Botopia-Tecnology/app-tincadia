/**
 * Chat Local Database
 * 
 * SQLite database for offline chat storage.
 * Implements WhatsApp-style local-first architecture:
 * - Messages stored locally first (source of truth)
 * - Sync with server in background
 * - Message states: pending → sent → delivered → read
 */

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;


// Flag to track if database is initialized
let isInitialized = false;

// Track last sync times for smart polling
const lastSyncTimes: Record<string, number> = {};

// Message status enum (WhatsApp-style)
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';

/**
 * Initialize database tables (called automatically on first use)
 */
export function initChatDatabase() {
    // Deprecated: Logic moved to ensureInitialized
    ensureInitialized();
}

/**
 * Ensure database is initialized before any operation
 */
/**
 * Ensure database is initialized before any operation
 */
function ensureInitialized(): SQLite.SQLiteDatabase {
    if (!db) {
        try {
            console.log('🔄 Opening database connection...');
            db = SQLite.openDatabaseSync('chat.db');

            // Ensure tables exist on every open (idempotent)
            db.execSync(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          other_user_id TEXT NOT NULL,
          other_user_name TEXT,
          other_user_avatar TEXT,
          other_user_phone TEXT,
          last_message TEXT,
          last_message_at TEXT,
          unread_count INTEGER DEFAULT 0,
          updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          server_id TEXT,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          status TEXT DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT,
          read_at TEXT,
          is_mine INTEGER DEFAULT 0,
          deleted_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS contacts (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          contact_user_id TEXT NOT NULL,
          phone TEXT,
          alias TEXT,
          custom_first_name TEXT,
          custom_last_name TEXT,
          updated_at TEXT
        );
        
        CREATE TABLE IF NOT EXISTS media_cache (
          storage_key TEXT PRIMARY KEY,
          public_url TEXT NOT NULL,
          conversation_id TEXT,
          type TEXT DEFAULT 'image',
          created_at TEXT NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
        CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
        CREATE INDEX IF NOT EXISTS idx_media_conv ON media_cache(conversation_id);
      `);
            console.log('✅ Chat database initialized and tables verified');
        } catch (error) {
            console.error('❌ Failed to initialize chat database:', error);
            throw error;
        }
    }
    return db;
}

// ==================== MESSAGES (WhatsApp Model) ====================

export interface LocalMessage {
    id: string;
    serverId?: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    status: MessageStatus;
    createdAt: string;
    updatedAt?: string;
    readAt?: string;
    isMine: boolean;
    deletedAt?: string;
}

/**
 * Save or update a message (optimistic update)
 */
export function saveMessage(msg: {
    id: string;
    serverId?: string;
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
    status?: MessageStatus;
    createdAt: string;
    updatedAt?: string;
    readAt?: string;
    isMine: boolean;
    deletedAt?: string;
}) {
    const database = ensureInitialized();

    // Check if message exists to prevent status regression
    // Rank: read (3) > delivered (2) > sent (1) > pending (0)
    const statusRank = {
        'read': 3,
        'delivered': 2,
        'sent': 1,
        'pending': 0,
    };

    let shouldUpdate = true;
    let currentStatus = null;

    try {
        const existing = database.getAllSync(
            `SELECT status FROM messages WHERE id = ?`,
            [msg.id]
        );

        if (existing && existing.length > 0) {
            currentStatus = (existing[0] as any).status;
            const currentRank = statusRank[currentStatus as MessageStatus] || 0;
            const newRank = statusRank[msg.status || 'pending'] || 0;

            // If existing is 'read', never go back to 'sent' or 'delivered'
            // If existing is 'delivered', never go back to 'sent'
            if (currentRank > newRank) {
                // Keep the higher status
                msg.status = currentStatus as MessageStatus;
                // If we kept 'read', ensure readAt is preserved if not provided
                if (currentStatus === 'read' && !msg.readAt) {
                    // We might lose the original readAt if we don't fetch it, 
                    // but usually readAt comes with 'read' status.
                    // Ideally we should preserve the record better, but for now preventing status flip is key.
                }
                console.log(`🛡️ Preventing status regression for ${msg.id}: ${currentStatus} -> ${msg.status}`);
            }
        }
    } catch (e) {
        // Ignore check errors
    }

    database.runSync(
        `INSERT OR REPLACE INTO messages 
     (id, server_id, conversation_id, sender_id, content, type, status, created_at, updated_at, read_at, is_mine, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            msg.id,
            msg.serverId || null,
            msg.conversationId,
            msg.senderId,
            msg.content,
            msg.type || 'text',
            msg.status || 'pending',
            msg.createdAt,
            msg.updatedAt || null,
            msg.readAt || null,
            msg.isMine ? 1 : 0,
            msg.deletedAt || null,
        ]
    );
}

/**
 * Update message status (pending → sent → delivered → read)
 */
export function updateMessageStatus(messageId: string, status: MessageStatus, serverId?: string) {
    const database = ensureInitialized();
    if (serverId) {
        database.runSync(
            `UPDATE messages SET status = ?, server_id = ?, updated_at = ? WHERE id = ?`,
            [status, serverId, new Date().toISOString(), messageId]
        );
    } else {
        database.runSync(
            `UPDATE messages SET status = ?, updated_at = ? WHERE id = ?`,
            [status, new Date().toISOString(), messageId]
        );
    }
}

/**
 * Mark message as read (update read_at timestamp)
 */
export function markMessageAsRead(messageId: string) {
    const database = ensureInitialized();
    const now = new Date().toISOString();
    database.runSync(
        `UPDATE messages SET status = 'read', read_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, messageId]
    );
}

/**
 * Get all messages for a conversation
 */
export function getMessages(conversationId: string): LocalMessage[] {
    const database = ensureInitialized();
    const rows = database.getAllSync<{
        id: string;
        server_id: string | null;
        conversation_id: string;
        sender_id: string;
        content: string;
        type: string;
        status: string;
        created_at: string;
        updated_at: string | null;
        read_at: string | null;
        is_mine: number;
        deleted_at: string | null;
    }>(
        `SELECT * FROM messages 
     WHERE conversation_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
        [conversationId]
    );

    return rows.map(row => ({
        id: row.id,
        serverId: row.server_id || undefined,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        content: row.content,
        type: row.type,
        status: row.status as MessageStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at || undefined,
        readAt: row.read_at || undefined,
        isMine: row.is_mine === 1,
        deletedAt: row.deleted_at || undefined,
    }));
}

/**
 * Get last message timestamp for incremental sync
 */
export function getLastMessageTimestamp(conversationId: string): string | null {
    const database = ensureInitialized();
    const result = database.getFirstSync<{ max_created: string | null }>(
        `SELECT MAX(created_at) as max_created FROM messages WHERE conversation_id = ? AND server_id IS NOT NULL`,
        [conversationId]
    );
    return result?.max_created || null;
}

/**
 * Get pending messages (not yet synced to server)
 */
export function getPendingMessages(conversationId: string): LocalMessage[] {
    const database = ensureInitialized();
    const rows = database.getAllSync<{
        id: string;
        server_id: string | null;
        conversation_id: string;
        sender_id: string;
        content: string;
        type: string;
        status: string;
        created_at: string;
        updated_at: string | null;
        read_at: string | null;
        is_mine: number;
        deleted_at: string | null;
    }>(
        `SELECT * FROM messages 
     WHERE conversation_id = ? AND status = 'pending' AND deleted_at IS NULL
     ORDER BY created_at ASC`,
        [conversationId]
    );
    return rows.map(row => ({
        id: row.id,
        serverId: row.server_id || undefined,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        content: row.content,
        type: row.type,
        status: row.status as MessageStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at || undefined,
        readAt: row.read_at || undefined,
        isMine: row.is_mine === 1,
        deletedAt: row.deleted_at || undefined,
    }));
}

/**
 * Delete a message by ID
 */
export function deleteMessage(messageId: string) {
    const database = ensureInitialized();
    database.runSync(`DELETE FROM messages WHERE id = ?`, [messageId]);
}

/**
 * Soft delete a message (mark as deleted)
 */
export function softDeleteMessage(messageId: string) {
    const database = ensureInitialized();
    database.runSync(
        `UPDATE messages SET deleted_at = ? WHERE id = ?`,
        [new Date().toISOString(), messageId]
    );
}

// ==================== CONVERSATIONS ====================

/**
 * Save or update a conversation
 */
export function saveConversation(conv: {
    id: string;
    otherUserId: string;
    otherUserName?: string;
    otherUserAvatar?: string;
    otherUserPhone?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount?: number;
}) {
    const database = ensureInitialized();
    const now = new Date().toISOString();
    database.runSync(
        `INSERT OR REPLACE INTO conversations 
     (id, other_user_id, other_user_name, other_user_avatar, other_user_phone, last_message, last_message_at, unread_count, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            conv.id,
            conv.otherUserId,
            conv.otherUserName || '',
            conv.otherUserAvatar || '',
            conv.otherUserPhone || '',
            conv.lastMessage || '',
            conv.lastMessageAt || '',
            conv.unreadCount || 0,
            now,
        ]
    );
}

/**
 * Get all conversations ordered by last message
 */
export function getConversations() {
    const database = ensureInitialized();
    return database.getAllSync<{
        id: string;
        other_user_id: string;
        other_user_name: string;
        other_user_avatar: string;
        other_user_phone: string;
        last_message: string;
        last_message_at: string;
        unread_count: number;
        updated_at: string;
    }>(
        `SELECT * FROM conversations ORDER BY last_message_at DESC`
    );
}

/**
 * Update unread count for a conversation
 */
export function updateUnreadCount(conversationId: string, count: number) {
    const database = ensureInitialized();
    database.runSync(
        `UPDATE conversations SET unread_count = ? WHERE id = ?`,
        [count, conversationId]
    );
}

/**
 * Update conversation preview (last message) without overwriting other details
 */
export function updateConversationPreview(
    conversationId: string,
    lastMessage: string,
    lastMessageAt: string,
    incrementUnread: boolean = false
) {
    const database = ensureInitialized();
    if (incrementUnread) {
        database.runSync(
            `UPDATE conversations 
             SET last_message = ?, last_message_at = ?, unread_count = unread_count + 1, updated_at = ? 
             WHERE id = ?`,
            [lastMessage, lastMessageAt, new Date().toISOString(), conversationId]
        );
    } else {
        database.runSync(
            `UPDATE conversations 
             SET last_message = ?, last_message_at = ?, updated_at = ? 
             WHERE id = ?`,
            [lastMessage, lastMessageAt, new Date().toISOString(), conversationId]
        );
    }
}

/**
 * Mark a conversation as read locally (set unreadCount to 0)
 */
export function markConversationAsRead(conversationId: string) {
    const database = ensureInitialized();
    database.runSync(
        `UPDATE conversations SET unread_count = 0 WHERE id = ?`,
        [conversationId]
    );
}

// ==================== CONTACTS ====================

/**
 * Save or update a contact
 */
export function saveContact(contact: {
    id: string;
    ownerId: string;
    contactUserId: string;
    phone?: string;
    alias?: string;
    customFirstName?: string;
    customLastName?: string;
}) {
    // Validate only truly required fields (phone can be empty)
    if (!contact.id || !contact.ownerId || !contact.contactUserId) {
        console.warn('⚠️ saveContact: Missing required field(s), skipping', {
            hasId: !!contact.id,
            hasOwnerId: !!contact.ownerId,
            hasContactUserId: !!contact.contactUserId,
        });
        return;
    }

    const database = ensureInitialized();
    const now = new Date().toISOString();
    database.runSync(
        `INSERT OR REPLACE INTO contacts 
     (id, owner_id, contact_user_id, phone, alias, custom_first_name, custom_last_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            contact.id,
            contact.ownerId,
            contact.contactUserId,
            contact.phone || '',
            contact.alias || '',
            contact.customFirstName || '',
            contact.customLastName || '',
            now,
        ]
    );
}

/**
 * Get all contacts for a user
 */
export function getLocalContacts(ownerId: string) {
    const database = ensureInitialized();
    return database.getAllSync<{
        id: string;
        owner_id: string;
        contact_user_id: string;
        phone: string;
        alias: string;
        custom_first_name: string;
        custom_last_name: string;
        updated_at: string;
    }>(
        `SELECT * FROM contacts WHERE owner_id = ? ORDER BY custom_first_name ASC`,
        [ownerId]
    );
}

/**
 * Delete a contact by ID
 */
export function deleteContact(contactId: string) {
    const database = ensureInitialized();
    database.runSync(`DELETE FROM contacts WHERE id = ?`, [contactId]);
}

// ==================== SYNC UTILITIES ====================

/**
 * Check if we should sync (avoid rapid repeated syncs)
 */
export function shouldSync(key: string, minIntervalMs: number = 5000): boolean {
    const now = Date.now();
    const lastSync = lastSyncTimes[key] || 0;

    if (now - lastSync < minIntervalMs) {
        return false; // Too soon, skip sync
    }

    lastSyncTimes[key] = now;
    return true;
}

/**
 * Get last sync time for a key
 */
export function getLastSyncTime(key: string): number {
    return lastSyncTimes[key] || 0;
}

/**
 * Update last sync time for a key
 */
export function updateSyncTime(key: string) {
    lastSyncTimes[key] = Date.now();
}

// ==================== CLEANUP ====================

/**
 * Clear all chat data (for logout)
 */
export function clearChatDatabase() {
    const database = ensureInitialized();
    database.runSync(`DELETE FROM messages`);
    database.runSync(`DELETE FROM conversations`);
    database.runSync(`DELETE FROM contacts`);
    console.log('🗑️ Chat database cleared');
}

/**
 * Clear only contacts (for re-sync)
 */
export function clearContacts(ownerId: string) {
    const database = ensureInitialized();
    database.runSync(`DELETE FROM contacts WHERE owner_id = ?`, [ownerId]);
}

// ==================== MEDIA CACHE ====================

export interface CachedMedia {
    storageKey: string;
    publicUrl: string;
    conversationId?: string;
    type: 'image' | 'audio' | 'video';
    createdAt: string;
}

/**
 * Save media URL to cache
 */
export function saveMediaUrl(media: {
    storageKey: string;
    publicUrl: string;
    conversationId?: string;
    type?: 'image' | 'audio' | 'video';
}) {
    const database = ensureInitialized();
    const now = new Date().toISOString();
    database.runSync(
        `INSERT OR REPLACE INTO media_cache 
     (storage_key, public_url, conversation_id, type, created_at)
     VALUES (?, ?, ?, ?, ?)`,
        [
            media.storageKey,
            media.publicUrl,
            media.conversationId || null,
            media.type || 'image',
            now,
        ]
    );
}

/**
 * Get cached media URL by storage key
 * Returns null if not cached
 */
export function getMediaUrl(storageKey: string): string | null {
    const database = ensureInitialized();
    const result = database.getFirstSync<{ public_url: string }>(
        `SELECT public_url FROM media_cache WHERE storage_key = ?`,
        [storageKey]
    );
    return result?.public_url || null;
}

/**
 * Get all cached media for a conversation
 */
export function getMediaForConversation(conversationId: string): CachedMedia[] {
    const database = ensureInitialized();
    const rows = database.getAllSync<{
        storage_key: string;
        public_url: string;
        conversation_id: string | null;
        type: string;
        created_at: string;
    }>(
        `SELECT * FROM media_cache WHERE conversation_id = ? ORDER BY created_at DESC`,
        [conversationId]
    );

    return rows.map(row => ({
        storageKey: row.storage_key,
        publicUrl: row.public_url,
        conversationId: row.conversation_id || undefined,
        type: row.type as 'image' | 'audio' | 'video',
        createdAt: row.created_at,
    }));
}

/**
 * Clear media cache for a conversation
 */
export function clearMediaCache(conversationId?: string) {
    const database = ensureInitialized();
    if (conversationId) {
        database.runSync(`DELETE FROM media_cache WHERE conversation_id = ?`, [conversationId]);
    } else {
        database.runSync(`DELETE FROM media_cache`);
    }
}
