/**
 * useChat Hook - WhatsApp Model
 * 
 * Manages chat messages using WhatsApp-style architecture:
 * - Local-first: Messages stored in SQLite (source of truth)
 * - Optimistic updates: Show immediately, sync in background
 * - Message states: pending → sent → delivered → read
 * - Incremental sync: Only fetch new messages since last timestamp
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
    getMessages as getLocalMessages,
    saveMessage,
    updateMessageStatus,
    getLastMessageTimestamp,
    deleteMessage as deleteLocalMessage,
    softDeleteMessage,
    LocalMessage,
    MessageStatus,
} from '../database/chatDatabase';
import { chatService } from '../services/chat.service';

export interface Message {
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
}

interface UseChatReturn {
    messages: Message[];
    sendMessage: (content: string) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    retryPending: () => Promise<void>;
}

export function useChat(conversationId: string, userId: string): UseChatReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isSyncingRef = useRef(false);

    // Transform LocalMessage to UI Message
    const transformMessage = useCallback((m: LocalMessage): Message => ({
        id: m.id,
        serverId: m.serverId,
        conversationId: m.conversationId,
        senderId: m.senderId,
        content: m.content,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        readAt: m.readAt,
        isMine: m.isMine,
    }), []);

    // Load messages from local SQLite (instant)
    const loadLocalMessages = useCallback(() => {
        try {
            const localMsgs = getLocalMessages(conversationId);
            setMessages(localMsgs.map(transformMessage));
        } catch (err) {
            console.error('Error loading local messages:', err);
        }
    }, [conversationId, transformMessage]);

    // Sync messages from server (incremental)
    const syncFromServer = useCallback(async () => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;

        try {
            // Get last synced message timestamp for incremental sync
            const lastTimestamp = getLastMessageTimestamp(conversationId);

            console.log('📡 Syncing messages since:', lastTimestamp || 'beginning');

            // Fetch messages (server should support `since` param)
            const { messages: serverMessages } = await chatService.getMessages(conversationId);

            // Filter only new messages if we have a timestamp (client-side filter as fallback)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newMessages = lastTimestamp
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? serverMessages.filter((msg: any) => {
                    const msgCreatedAt = msg.createdAt || msg.created_at;
                    return msgCreatedAt > lastTimestamp;
                })
                : serverMessages;

            if (newMessages.length > 0) {
                console.log('📥 Got', newMessages.length, 'new messages');
            }

            // Process all server messages (update existing or insert new)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serverMessages.forEach((msg: any) => {
                const msgConversationId = msg.conversationId || msg.conversation_id;
                const msgSenderId = msg.senderId || msg.sender_id;
                const msgCreatedAt = msg.createdAt || msg.created_at;
                const msgUpdatedAt = msg.updatedAt || msg.updated_at;
                const msgReadAt = msg.readAt || msg.read_at;
                const isMine = msgSenderId === userId;

                // Determine status based on server data
                let status: MessageStatus = 'sent';
                if (msgReadAt) {
                    status = 'read';
                } else if (!isMine) {
                    // Incoming message that we received = delivered from their perspective
                    status = 'delivered';
                }

                // Save to local DB
                saveMessage({
                    id: msg.id,
                    serverId: msg.id,
                    conversationId: msgConversationId,
                    senderId: msgSenderId,
                    content: msg.content,
                    type: msg.type || 'text',
                    status,
                    createdAt: msgCreatedAt || new Date().toISOString(),
                    updatedAt: msgUpdatedAt,
                    readAt: msgReadAt,
                    isMine,
                });
            });

            // Reload local messages to update UI
            loadLocalMessages();
        } catch (err) {
            console.error('Error syncing messages from server:', err);
            setError('Error al cargar mensajes');
        } finally {
            isSyncingRef.current = false;
        }
    }, [conversationId, userId, loadLocalMessages]);

    // Mark messages as read when user enters the chat
    const markMessagesAsRead = useCallback(async () => {
        try {
            await chatService.markAsRead(conversationId, userId);
            console.log('✓ Messages marked as read');
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [conversationId, userId]);

    // Initial load and polling setup
    useEffect(() => {
        // 1. Load local messages immediately (instant UI)
        loadLocalMessages();
        setIsLoading(false);

        // 2. Sync from server in background
        syncFromServer().then(() => {
            // 3. Mark messages as read after loading
            markMessagesAsRead();
        });

        // 4. Poll for new messages every 15 seconds (reduced from 10s)
        pollingIntervalRef.current = setInterval(() => {
            syncFromServer();
        }, 15000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [conversationId, userId, loadLocalMessages, syncFromServer, markMessagesAsRead]);

    // Send a message with optimistic update (WhatsApp style)
    const sendMessage = useCallback(async (content: string) => {
        const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        // 1. Save as PENDING (optimistic update)
        saveMessage({
            id: tempId,
            conversationId,
            senderId: userId,
            content,
            type: 'text',
            status: 'pending', // ⏳ Pending
            createdAt: now,
            isMine: true,
        });

        // Reload to show pending message immediately
        loadLocalMessages();

        try {
            // 2. Send to server
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { message: serverMsg } = await chatService.sendMessage({
                conversationId,
                senderId: userId,
                content,
                type: 'text',
            }) as { message: any };

            // 3. Update local message: pending → SENT
            // Delete temp and save with server ID
            deleteLocalMessage(tempId);

            const serverMsgConvId = serverMsg.conversationId || serverMsg.conversation_id || conversationId;
            const serverMsgSenderId = serverMsg.senderId || serverMsg.sender_id || userId;
            const serverMsgCreatedAt = serverMsg.createdAt || serverMsg.created_at || now;

            saveMessage({
                id: serverMsg.id,
                serverId: serverMsg.id,
                conversationId: serverMsgConvId,
                senderId: serverMsgSenderId,
                content: serverMsg.content,
                type: serverMsg.type || 'text',
                status: 'sent', // ✓ Sent
                createdAt: serverMsgCreatedAt,
                isMine: true,
            });

            loadLocalMessages();
            console.log('✓ Message sent:', serverMsg.id);
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Error al enviar mensaje');
            // Message stays as PENDING - can retry later
        }
    }, [conversationId, userId, loadLocalMessages]);

    // Retry sending pending messages
    const retryPending = useCallback(async () => {
        const pendingMsgs = messages.filter(m => m.status === 'pending');

        for (const msg of pendingMsgs) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { message: serverMsg } = await chatService.sendMessage({
                    conversationId: msg.conversationId,
                    senderId: msg.senderId,
                    content: msg.content,
                    type: msg.type as 'text' | 'image' | 'audio' | 'call' | 'call_ended',
                }) as { message: any };

                // Update local message
                deleteLocalMessage(msg.id);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: serverMsg.content,
                    type: serverMsg.type || 'text',
                    status: 'sent',
                    createdAt: serverMsg.createdAt || serverMsg.created_at,
                    isMine: true,
                });
            } catch (err) {
                console.error('Error retrying message:', err);
            }
        }

        loadLocalMessages();
    }, [messages, conversationId, userId, loadLocalMessages]);

    // Edit a message
    const editMessage = useCallback(async (messageId: string, content: string) => {
        const existingMsg = messages.find(m => m.id === messageId || m.serverId === messageId);

        if (!existingMsg) return;

        try {
            await chatService.editMessage(existingMsg.serverId || messageId, content);

            // Update local DB
            saveMessage({
                ...existingMsg,
                content,
                updatedAt: new Date().toISOString(),
            });

            loadLocalMessages();
        } catch (err) {
            console.error('Error editing message:', err);
            setError('Error al editar mensaje');
        }
    }, [messages, loadLocalMessages]);

    // Delete a message
    const deleteMessage = useCallback(async (messageId: string) => {
        const existingMsg = messages.find(m => m.id === messageId || m.serverId === messageId);

        if (!existingMsg) return;

        try {
            // Soft delete locally first (optimistic)
            softDeleteMessage(messageId);
            loadLocalMessages();

            // Delete on server
            if (existingMsg.serverId) {
                await chatService.deleteMessage(existingMsg.serverId);
            }
        } catch (err) {
            console.error('Error deleting message:', err);
            setError('Error al eliminar mensaje');
            // Reload to undo soft delete
            loadLocalMessages();
        }
    }, [messages, loadLocalMessages]);

    return {
        messages,
        sendMessage,
        editMessage,
        deleteMessage,
        isLoading,
        error,
        retryPending,
    };
}
