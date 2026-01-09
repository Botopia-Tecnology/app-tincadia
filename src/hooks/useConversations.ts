/**
 * useConversations Hook
 * 
 * Manages the list of chat conversations.
 * - Loads from local SQLite (instant)
 * - Syncs with server in background
 */

import { useEffect, useState, useCallback } from 'react';
import { getConversations, saveConversation } from '../database/chatDatabase';
import { chatService, Conversation as ApiConversation } from '../services/chat.service';

export interface Conversation {
    id: string;
    otherUserId?: string; // Optional for groups
    otherUserName: string;
    otherUserAvatar: string;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
    // Group fields
    type?: 'direct' | 'group';
    title?: string;
    imageUrl?: string;
}

interface UseConversationsReturn {
    conversations: Conversation[];
    refresh: () => Promise<void>;
    createConversation: (otherUserId: string) => Promise<string>;
    isLoading: boolean;
    error: string | null;
}

export function useConversations(userId: string): UseConversationsReturn {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Transform local DB conversation to our interface
    const transformLocalConversation = (c: {
        id: string;
        other_user_id: string | null;
        other_user_name: string;
        other_user_avatar: string;
        last_message: string;
        last_message_at: string;
        unread_count: number;
        type?: string | null;
        title?: string | null;
        image_url?: string | null;
    }): Conversation => ({
        id: c.id,
        otherUserId: c.other_user_id || undefined,
        otherUserName: c.other_user_name,
        otherUserAvatar: c.other_user_avatar,
        lastMessage: c.last_message,
        lastMessageAt: c.last_message_at,
        unreadCount: c.unread_count,
        type: (c.type as 'direct' | 'group') || 'direct',
        title: c.title || undefined,
        imageUrl: c.image_url || undefined,
    });

    // Load conversations from local SQLite
    const loadLocalConversations = useCallback(() => {
        try {
            const localConvs = getConversations();
            setConversations(localConvs.map(transformLocalConversation));
        } catch (err) {
            console.error('Error loading local conversations:', err);
        }
    }, []);

    // Sync conversations from server
    const syncFromServer = useCallback(async () => {
        if (!userId) {
            console.log('⚠️ No userId provided to useConversations');
            return;
        }

        console.log('📡 Fetching conversations for userId:', userId);

        try {
            const { conversations: serverConvs } = await chatService.getConversations(userId);
            console.log('📡 Server returned conversations:', serverConvs?.length || 0);

            // Save each server conversation to local DB
            serverConvs.forEach((conv: ApiConversation) => {
                saveConversation({
                    id: conv.id,
                    otherUserId: conv.otherUserId || undefined,
                    otherUserName: conv.otherUserName,
                    otherUserAvatar: conv.otherUserAvatar,
                    lastMessage: conv.lastMessage,
                    lastMessageAt: conv.lastMessageAt,
                    unreadCount: conv.unreadCount,
                    // Group fields
                    type: conv.type as 'direct' | 'group' || 'direct',
                    title: conv.title,
                    imageUrl: conv.imageUrl,
                });
            });

            loadLocalConversations();
        } catch (err) {
            console.error('Error syncing conversations:', err);
            setError('Error al cargar conversaciones');
        } finally {
            setIsLoading(false);
        }
    }, [userId, loadLocalConversations]);

    // Initial load
    useEffect(() => {
        // Load local first (instant)
        loadLocalConversations();
        setIsLoading(false);

        // Then sync from server
        syncFromServer();
    }, [loadLocalConversations, syncFromServer]);

    // Refresh function
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        await syncFromServer();
    }, [syncFromServer]);

    // Create (or get) a conversation with another user
    const createConversation = useCallback(async (otherUserId: string): Promise<string> => {
        try {
            if (!userId) {
                throw new Error('No userId provided');
            }

            const { conversationId } = await chatService.startConversation(userId, otherUserId);
            // Local DB will be updated on next sync; returning id is enough for navigation.
            return conversationId;
        } catch (err) {
            console.error('Error creating conversation:', err);
            setError('Error al crear conversación');
            throw err;
        }
    }, [userId]);

    return {
        conversations,
        refresh,
        createConversation,
        isLoading,
        error,
    };
}
