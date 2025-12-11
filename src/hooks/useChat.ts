/**
 * useChat Hook
 * 
 * Manages chat messages for a specific conversation.
 * - Loads messages from local SQLite (instant)
 * - Subscribes to real-time updates via Supabase
 * - Optimistic message sending
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    getMessages,
    saveMessage,
    deleteMessage as deleteLocalMessage
} from '../database/chatDatabase';
import { chatService, Message as ApiMessage } from '../services/chat.service';

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    createdAt: string;
    isMine: boolean;
    isSynced: boolean;
}

interface UseChatReturn {
    messages: Message[];
    sendMessage: (content: string) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
}

export function useChat(conversationId: string, userId: string): UseChatReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Transform local DB message to our Message interface
    const transformLocalMessage = useCallback((m: {
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string;
        type: string;
        created_at: string;
        is_mine: number;
        is_synced: number;
    }): Message => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderId: m.sender_id,
        content: m.content,
        type: m.type,
        createdAt: m.created_at,
        isMine: m.is_mine === 1,
        isSynced: m.is_synced === 1,
    }), []);

    // Load messages from local SQLite
    const loadLocalMessages = useCallback(() => {
        try {
            const localMsgs = getMessages(conversationId);
            setMessages(localMsgs.map(transformLocalMessage));
        } catch (err) {
            console.error('Error loading local messages:', err);
        }
    }, [conversationId, transformLocalMessage]);

    // Sync messages from server
    const syncFromServer = useCallback(async () => {
        try {
            const { messages: serverMessages } = await chatService.getMessages(conversationId);

            // Save each server message to local DB
            // Handle both camelCase and snake_case field names from API
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serverMessages.forEach((msg: any) => {
                const msgConversationId = msg.conversationId || (msg as Record<string, unknown>).conversation_id as string;
                const msgSenderId = msg.senderId || (msg as Record<string, unknown>).sender_id as string;
                const msgCreatedAt = msg.createdAt || (msg as Record<string, unknown>).created_at as string;

                // Skip if required fields are missing
                if (!msg.id || !msgConversationId || !msgSenderId) {
                    console.warn('Skipping message with missing fields:', msg);
                    return;
                }

                saveMessage({
                    id: msg.id,
                    conversationId: msgConversationId,
                    senderId: msgSenderId,
                    content: msg.content,
                    type: msg.type || 'text',
                    createdAt: msgCreatedAt || new Date().toISOString(),
                    isMine: msgSenderId === userId,
                    isSynced: true,
                });
            });

            loadLocalMessages();
        } catch (err) {
            console.error('Error syncing messages from server:', err);
            setError('Error al cargar mensajes');
        }
    }, [conversationId, userId, loadLocalMessages]);

    useEffect(() => {
        // 1. Load local messages immediately (instant)
        loadLocalMessages();
        setIsLoading(false);

        // 2. Sync from server in background
        syncFromServer();

        // 3. Subscribe to real-time updates via Supabase
        const channel = supabase
            .channel(`conversation:${conversationId}`)
            .on('broadcast', { event: 'message' }, ({ payload }) => {
                console.log('📩 Received real-time message:', payload);
                const msg: Message = {
                    id: payload.id,
                    conversationId: payload.conversation_id || payload.conversationId,
                    senderId: payload.sender_id || payload.senderId,
                    content: payload.content,
                    type: payload.type || 'text',
                    createdAt: payload.created_at || payload.createdAt,
                    isMine: (payload.sender_id || payload.senderId) === userId,
                    isSynced: true,
                };

                // Save to local DB and refresh
                saveMessage({
                    id: msg.id,
                    conversationId: msg.conversationId,
                    senderId: msg.senderId,
                    content: msg.content,
                    type: msg.type,
                    createdAt: msg.createdAt,
                    isMine: msg.isMine,
                    isSynced: true,
                });
                loadLocalMessages();
            })
            .subscribe((status) => {
                console.log('📡 Supabase channel status:', status);
            });

        return () => {
            channel.unsubscribe();
        };
    }, [conversationId, userId, loadLocalMessages, syncFromServer]);

    // Send a message with optimistic update
    const sendMessage = useCallback(async (content: string) => {
        const tempId = `temp_${Date.now()}`;
        const now = new Date().toISOString();

        // Save optimistically to local DB
        const optimisticMsg = {
            id: tempId,
            conversationId,
            senderId: userId,
            content,
            type: 'text',
            createdAt: now,
            isMine: true,
            isSynced: false,
        };

        saveMessage(optimisticMsg);
        loadLocalMessages();

        try {
            // Send to server
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { message: serverMsg } = await chatService.sendMessage({
                conversationId,
                senderId: userId,
                content,
                type: 'text',
            }) as { message: any };

            // Delete temp message and save real one
            // Handle both camelCase and snake_case from API
            deleteLocalMessage(tempId);
            saveMessage({
                id: serverMsg.id,
                conversationId: serverMsg.conversationId || serverMsg.conversation_id || conversationId,
                senderId: serverMsg.senderId || serverMsg.sender_id || userId,
                content: serverMsg.content,
                type: serverMsg.type || 'text',
                createdAt: serverMsg.createdAt || serverMsg.created_at || now,
                isMine: true,
                isSynced: true,
            });
            loadLocalMessages();
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Error al enviar mensaje');
            // Message stays in local DB marked as not synced
        }
    }, [conversationId, userId, loadLocalMessages]);

    // Edit a message
    const editMessage = useCallback(async (messageId: string, content: string) => {
        try {
            await chatService.editMessage(messageId, content);
            // Update local DB
            const existingMsg = messages.find(m => m.id === messageId);
            if (existingMsg) {
                saveMessage({
                    ...existingMsg,
                    content,
                    isSynced: true,
                });
                loadLocalMessages();
            }
        } catch (err) {
            console.error('Error editing message:', err);
            setError('Error al editar mensaje');
        }
    }, [messages, loadLocalMessages]);

    // Delete a message
    const deleteMessage = useCallback(async (messageId: string) => {
        try {
            await chatService.deleteMessage(messageId);
            deleteLocalMessage(messageId);
            loadLocalMessages();
        } catch (err) {
            console.error('Error deleting message:', err);
            setError('Error al eliminar mensaje');
        }
    }, [loadLocalMessages]);

    return {
        messages,
        sendMessage,
        editMessage,
        deleteMessage,
        isLoading,
        error,
    };
}
