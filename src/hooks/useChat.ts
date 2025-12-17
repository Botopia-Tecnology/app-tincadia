/**
 * useChat Hook
 * 
 * Manages chat messages for a specific conversation.
 * - Loads messages from local SQLite (instant)
 * - Syncs from backend API
 * - Polls for new messages periodically
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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
    isRead?: boolean; // true if the recipient has read this message
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
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        isRead: false, // Will be updated from server
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

            // Transform server messages to our format with isRead
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transformedMessages: Message[] = serverMessages.map((msg: any) => {
                const msgConversationId = msg.conversationId || msg.conversation_id;
                const msgSenderId = msg.senderId || msg.sender_id;
                const msgCreatedAt = msg.createdAt || msg.created_at;
                const msgReadAt = msg.readAt || msg.read_at;

                // Save to local DB for offline support
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

                return {
                    id: msg.id,
                    conversationId: msgConversationId,
                    senderId: msgSenderId,
                    content: msg.content,
                    type: msg.type || 'text',
                    createdAt: msgCreatedAt || new Date().toISOString(),
                    isMine: msgSenderId === userId,
                    isSynced: true,
                    isRead: !!msgReadAt, // Has read_at = is read
                };
            });

            // Set messages directly from server (includes isRead status)
            setMessages(transformedMessages);
        } catch (err) {
            console.error('Error syncing messages from server:', err);
            setError('Error al cargar mensajes');
        }
    }, [conversationId, userId]);

    // Mark messages as read when user enters the chat
    const markMessagesAsRead = useCallback(async () => {
        try {
            await chatService.markAsRead(conversationId, userId);
            console.log('✓ Messages marked as read');
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [conversationId, userId]);

    useEffect(() => {
        // 1. Load local messages immediately (instant)
        loadLocalMessages();
        setIsLoading(false);

        // 2. Sync from server in background
        syncFromServer().then(() => {
            // 3. Mark messages as read after loading
            markMessagesAsRead();
        });

        // 4. Poll for new messages every 10 seconds (instead of Supabase realtime)
        pollingIntervalRef.current = setInterval(() => {
            syncFromServer();
        }, 10000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [conversationId, userId, loadLocalMessages, syncFromServer, markMessagesAsRead]);

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
