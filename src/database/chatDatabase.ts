/**
 * Chat Local Database
 * 
 * SQLite database for offline chat storage.
 * Stores conversations and messages locally for instant loading.
 */

import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('chat.db');

// Flag to track if database is initialized
let isInitialized = false;

/**
 * Initialize database tables (called automatically on first use)
 */
export function initChatDatabase() {
    if (isInitialized) return;

    try {
        db.execSync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      other_user_id TEXT NOT NULL,
      other_user_name TEXT,
      other_user_avatar TEXT,
      last_message TEXT,
      last_message_at TEXT,
      unread_count INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      created_at TEXT NOT NULL,
      is_mine INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 1
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
  `);
        isInitialized = true;
        console.log('✅ Chat database initialized');
    } catch (error) {
        console.error('❌ Failed to initialize chat database:', error);
    }
}

/**
 * Ensure database is initialized before any operation
 */
function ensureInitialized() {
    if (!isInitialized) {
        initChatDatabase();
    }
}

/**
 * Save or update a message
 */
export function saveMessage(msg: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type?: string;
    createdAt: string;
    isMine: boolean;
    isSynced?: boolean;
}) {
    ensureInitialized();
    db.runSync(
        `INSERT OR REPLACE INTO messages 
     (id, conversation_id, sender_id, content, type, created_at, is_mine, is_synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            msg.id,
            msg.conversationId,
            msg.senderId,
            msg.content,
            msg.type || 'text',
            msg.createdAt,
            msg.isMine ? 1 : 0,
            msg.isSynced !== false ? 1 : 0,
        ]
    );
}

/**
 * Get all messages for a conversation
 */
export function getMessages(conversationId: string) {
    ensureInitialized();
    return db.getAllSync<{
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string;
        type: string;
        created_at: string;
        is_mine: number;
        is_synced: number;
    }>(
        `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY created_at ASC`,
        [conversationId]
    );
}

/**
 * Delete a message by ID
 */
export function deleteMessage(messageId: string) {
    ensureInitialized();
    db.runSync(`DELETE FROM messages WHERE id = ?`, [messageId]);
}

/**
 * Save or update a conversation
 */
export function saveConversation(conv: {
    id: string;
    otherUserId: string;
    otherUserName?: string;
    otherUserAvatar?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount?: number;
}) {
    ensureInitialized();
    db.runSync(
        `INSERT OR REPLACE INTO conversations 
     (id, other_user_id, other_user_name, other_user_avatar, last_message, last_message_at, unread_count)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            conv.id,
            conv.otherUserId,
            conv.otherUserName || '',
            conv.otherUserAvatar || '',
            conv.lastMessage || '',
            conv.lastMessageAt || '',
            conv.unreadCount || 0,
        ]
    );
}

/**
 * Get all conversations ordered by last message
 */
export function getConversations() {
    ensureInitialized();
    return db.getAllSync<{
        id: string;
        other_user_id: string;
        other_user_name: string;
        other_user_avatar: string;
        last_message: string;
        last_message_at: string;
        unread_count: number;
    }>(
        `SELECT * FROM conversations ORDER BY last_message_at DESC`
    );
}

/**
 * Update unread count for a conversation
 */
export function updateUnreadCount(conversationId: string, count: number) {
    db.runSync(
        `UPDATE conversations SET unread_count = ? WHERE id = ?`,
        [count, conversationId]
    );
}

/**
 * Clear all chat data (for logout)
 */
export function clearChatDatabase() {
    ensureInitialized();
    db.runSync(`DELETE FROM messages`);
    db.runSync(`DELETE FROM conversations`);
    console.log('🗑️ Chat database cleared');
}

