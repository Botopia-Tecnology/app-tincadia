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
import { DeviceEventEmitter } from 'react-native';
import {
    getMessages as getLocalMessages,
    saveMessage,
    updateMessageStatus,
    getLastMessageTimestamp,
    deleteMessage as deleteLocalMessage,
    softDeleteMessage,
    markConversationAsRead,
    updateConversationPreview,
    LocalMessage,
    MessageStatus,
} from '../database/chatDatabase';
import { chatService } from '../services/chat.service';
import { MessageMetadata } from '../types/chat.types';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

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
    // Reply metadata
    replyToId?: string;
    replyToContent?: string;
    replyToSender?: string;
    // General metadata (audio duration, publicId, etc.)
    metadata?: MessageMetadata;
}

interface UseChatReturn {
    messages: Message[];
    sendMessage: (content: string, type?: 'text' | 'image' | 'video' | 'audio' | 'call' | 'call_ended', metadata?: MessageMetadata, localContent?: string) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    retryPending: () => Promise<void>;
    markMessagesAsRead: () => Promise<void>;
}

export function useChat(
    conversationId: string, 
    userId: string, 
    options?: { readReceiptsEnabled?: boolean }
): UseChatReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isSyncingRef = useRef(false);
    const channelRef = useRef<RealtimeChannel | null>(null);

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
        replyToId: m.replyToId,
        replyToContent: m.replyToContent,
        replyToSender: m.replyToSender,
        metadata: m.metadata,
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
            const { messages: serverMessages } = await chatService.getMessages(conversationId, lastTimestamp || undefined);

            // Filter only new messages if we have a timestamp (client-side filter as fallback)
            const newMessages = lastTimestamp
                ? serverMessages.filter((msg) => {
                    const msgCreatedAt = (msg as any).createdAt || (msg as any).created_at;
                    return msgCreatedAt > lastTimestamp;
                })
                : serverMessages;

            if (newMessages.length > 0) {
                console.log('📥 Got', newMessages.length, 'new messages');
            }

            // Process all server messages (update existing or insert new)
            serverMessages.forEach((msg) => {
                const msgConversationId = (msg as any).conversationId || (msg as any).conversation_id;
                const msgSenderId = (msg as any).senderId || (msg as any).sender_id;
                const msgCreatedAt = (msg as any).createdAt || (msg as any).created_at;
                const msgUpdatedAt = (msg as any).updatedAt || (msg as any).updated_at;
                const msgReadAt = (msg as any).readAt || (msg as any).read_at;
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
                    // Reply metadata from server
                    replyToId: (msg as any).replyToId || (msg as any).reply_to_id || msg.metadata?.replyToId,
                    replyToContent: (msg as any).replyToContent || (msg as any).reply_to_content || msg.metadata?.replyToContent,
                    replyToSender: (msg as any).replyToSender || (msg as any).reply_to_sender || msg.metadata?.replyToSender,
                    // Metadata (duration, publicId, etc.)
                    metadata: msg.metadata as MessageMetadata,
                });
            });

            if (newMessages.length > 0) {
                console.log('📥 Got', newMessages.length, 'new messages');

                // If there are new messages that are NOT mine, mark as read automatically
                const hasIncoming = newMessages.some((msg) => {
                    const msgSenderId = (msg as any).senderId || (msg as any).sender_id;
                    return msgSenderId !== userId;
                });

                if (hasIncoming) {
                    markMessagesAsRead();
                }
            }

            // Reload local messages to update UI
            loadLocalMessages();
        } catch (err) {
            console.error('Error syncing messages from server:', err);
            setError('Error al cargar mensajes');
        } finally {
            isSyncingRef.current = false;
        }
    }, [conversationId, userId, loadLocalMessages]);

    // Listen for local manual updates (fallback for instant UI like Call drops)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('chat_local_update', (updatedConvId) => {
            if (updatedConvId === conversationId) {
                loadLocalMessages();
            }
        });
        return () => sub.remove();
    }, [conversationId, loadLocalMessages]);

    // Mark messages as read when user enters the chat
    const markMessagesAsRead = useCallback(async () => {
        // ✅ UPDATE LOCAL CACHE IMMEDIATELY (OPTIMISTIC)
        // This ensures the badge disappears even if user exits before API completes
        markConversationAsRead(conversationId);
        console.log('✓ Local conversation cache updated (unreadCount = 0) - OPTIMISTIC');

        if (options?.readReceiptsEnabled === false) {
            console.log('🚫 Read receipts disabled, skipping network sync');
            return;
        }

        // --- 1. BROADCAST FAST PATH (Optimistic) ---
        // We send this BEFORE the API call for zero-latency feedback to the sender.
        if (channelRef.current) {
            const state = channelRef.current.state;
            if (state === 'joined') {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'message_read',
                    payload: { conversationId, readerId: userId, timestamp: new Date().toISOString() },
                }).then((resp) => {
                    console.log('🚀 Optimistic ACK Sent Status:', resp);
                });
            } else {
                console.warn('⚠️ Channel not joined, skipping optimistic ACK');
            }
        }

        try {
            await chatService.markAsRead(conversationId, userId);
            console.log('✓ Messages marked as read (API confirmed)');
        } catch (err) {
            console.error('Error marking messages as read:', err);
        }
    }, [conversationId, userId]);

    // Subscribe to real-time updates for this specific conversation
    useEffect(() => {
        if (!conversationId || !userId) return;

        console.log(`🔌 Subscribing to real-time messages for conv: ${conversationId}`);

        // Normalize channel name to avoid mismatch
        const channelId = `chat:${conversationId.toLowerCase()}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const newId = (payload.new as { id: string }).id;
                    const oldId = (payload.old as { id: string }).id;
                    console.log(`⚡ Real-time event [${payload.eventType}] for msg: ${newId || oldId}`);

                    if (payload.eventType === 'INSERT') {
                        const msg = payload.new as { sender_id: string };
                        if (msg.sender_id !== userId) {
                            console.log('📥 Incoming message via DB insert, syncing for decryption...');
                        }
                        // Sync to get decrypted content (and any status updates)
                        syncFromServer();
                    } else if (payload.eventType === 'UPDATE') {
                        const msg = payload.new as { read_at?: string; sender_id: string; id: string };

                        // If it got marked as read, update local status DIRECTLY for instant UI response (blue check)
                        if (msg.read_at) {
                            console.log(`👁️ Message ${msg.id} marked as read via DB, updating UI`);
                            updateMessageStatus(msg.id, 'read');
                            loadLocalMessages();
                        }

                        // Also sync to ensure we have any other potential changes (like edited text)
                        if (msg.sender_id !== userId || !msg.read_at) {
                            syncFromServer();
                        }
                    } else if (payload.eventType === 'DELETE') {
                        console.log('🗑️ Message deleted, removing local copy');
                        const oldIdItem = (payload.old as { id: string }).id;
                        if (oldIdItem) {
                            deleteLocalMessage(oldIdItem);
                            loadLocalMessages();
                        }
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'new_message' },
                (payload) => {
                    const msg = payload.payload as any;
                    console.log('🚀 Broadcast [new_message] received:', msg?.id);

                    // Handle both snake_case (from DB) and camelCase (from sender broadcast)
                    const msgConversationId = msg?.conversationId || msg?.conversation_id;
                    const msgSenderId = msg?.senderId || msg?.sender_id;
                    const msgCreatedAt = msg?.createdAt || msg?.created_at;

                    if (msg && (msgConversationId as string)?.toLowerCase() === conversationId.toLowerCase() && msgSenderId !== userId) {
                        // 1. Save locally for instant rendering
                        saveMessage({
                            id: msg.id,
                            serverId: msg.id,
                            conversationId: msgConversationId,
                            senderId: msgSenderId,
                            content: msg.content,
                            type: msg.type || 'text',
                            status: 'delivered',
                            createdAt: msgCreatedAt,
                            isMine: false,
                        });
                        loadLocalMessages();

                        // NOTE: We DON'T auto-mark as read here!
                        // Messages are only marked as read when the user is ACTIVELY in this chat.
                        // The markMessagesAsRead happens in the main useEffect when user enters.
                        console.log('✅ Message received via broadcast, NOT auto-marking as read');
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'message_read' },
                (payload) => {
                    console.log('🚀 Broadcast [message_read] received:', payload);

                    // IF WE ARE THE SENDER of the messages being read
                    const readerId = (payload.payload as { readerId: string })?.readerId;
                    if (readerId && readerId !== userId) {
                        console.log('✅ Instant UI Update: Marking messages as read');

                        // OPTIMISTIC UI UPDATE: Update React state IMMEDIATELY
                        let changed = false;
                        setMessages(prevMessages =>
                            prevMessages.map(msg => {
                                if (msg.isMine && msg.status !== 'read') {
                                    changed = true; // Mark that a change occurred
                                    return { ...msg, status: 'read' as MessageStatus };
                                }
                                return msg;
                            })
                        );

                        // Then update DB in background (async, non-blocking)
                        setTimeout(() => {
                            const rows = getLocalMessages(conversationId);
                            rows.forEach(m => {
                                if (m.isMine && m.status !== 'read') {
                                    updateMessageStatus(m.id, 'read');
                                }
                            });
                        }, 0);

                        if (changed) {
                            loadLocalMessages();
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`📡 Subscription status for ${conversationId}:`, status);
            });

        channelRef.current = channel;

        return () => {
            console.log(`🔌 Unsubscribing from chat:${conversationId}`);
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [conversationId, userId, loadLocalMessages]);

    // Initial load and polling setup
    useEffect(() => {
        // 1. Load local messages immediately (instant UI)
        loadLocalMessages();
        setIsLoading(false);

        // 2. Mark messages as read IMMEDIATELY when entering chat
        // This updates local cache right away (don't wait for sync)
        markMessagesAsRead();

        // 3. Sync from server in background
        syncFromServer();

        // 4. Poll for new messages every 30 seconds as fail-safe (increased from 15s)
        pollingIntervalRef.current = setInterval(() => {
            syncFromServer();
        }, 30000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [conversationId, userId, loadLocalMessages, syncFromServer, markMessagesAsRead]);

    // Send a message with optimistic update (WhatsApp style)
    const sendMessage = useCallback(async (content: string, type: 'text' | 'image' | 'video' | 'audio' | 'call' | 'call_ended' = 'text', metadata?: MessageMetadata, localContent?: string) => {
        if (!content.trim()) return;

        // Optimistic update
        const tempId = Date.now().toString();
        const now = new Date().toISOString();

        const localMessage: LocalMessage = {
            id: tempId,
            conversationId,
            senderId: userId,
            content: localContent || content, // Use local content (e.g. file URI) if provided
            type,
            status: 'pending',
            createdAt: now,
            isMine: true,
            updatedAt: now,
            // Reply metadata
            replyToId: metadata?.replyToId as string | undefined,
            replyToContent: metadata?.replyToContent as string | undefined,
            replyToSender: metadata?.replyToSender as string | undefined,
        };

        saveMessage(localMessage);

        // Reload to show pending message immediately
        loadLocalMessages();

        try {
            // Send to server
            const { message: serverMsg } = await chatService.sendMessage({
                conversationId,
                senderId: userId,
                content,
                type,
                metadata, // Pass metadata (e.g., publicId)
            });

            // Update local message: pending → SENT
            deleteLocalMessage(tempId);

            const serverMsgConvId = (serverMsg as any).conversationId || (serverMsg as any).conversation_id || conversationId;
            const serverMsgSenderId = (serverMsg as any).senderId || (serverMsg as any).sender_id || userId;
            const serverMsgCreatedAt = (serverMsg as any).createdAt || (serverMsg as any).created_at || now;

            saveMessage({
                id: serverMsg.id,
                serverId: serverMsg.id,
                conversationId: serverMsgConvId,
                senderId: serverMsgSenderId,
                content: localContent || serverMsg.content, // Keep local URI for now if we want to avoid re-download immediately
                type,
                status: 'sent',
                createdAt: serverMsgCreatedAt,
                updatedAt: serverMsgCreatedAt,
                readAt: undefined,
                isMine: true,
                // Reply metadata from server or local
                replyToId: ((serverMsg as any).replyToId || (serverMsg as any).reply_to_id || metadata?.replyToId) as string | undefined,
                replyToContent: ((serverMsg as any).replyToContent || (serverMsg as any).reply_to_content || metadata?.replyToContent) as string | undefined,
                replyToSender: ((serverMsg as any).replyToSender || (serverMsg as any).reply_to_sender || metadata?.replyToSender) as string | undefined,
            });

            // --- BROADCAST FAST PATH (Send) ---
            if (channelRef.current && channelRef.current.state === 'joined') {
                console.log('🚀 Broadcasting new_message to recipient (Confirmed ID)...');
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: {
                        id: serverMsg.id,
                        conversationId: serverMsgConvId,
                        senderId: serverMsgSenderId,
                        content: serverMsg.content, // Recipient gets server content (text/placeholder) + should fetch for signed URL logic ideally
                        type,
                        createdAt: serverMsgCreatedAt,
                        conversation_id: serverMsgConvId, // Redundant but helpful if receiver uses snake_case payload
                        sender_id: serverMsgSenderId,
                        created_at: serverMsgCreatedAt,
                        isMine: false
                    },
                });
            }

            // Update conversation preview in local DB (optimistic list update)
            // This ensures ChatsScreen shows the new message at the top immediately
            const previewText = type === 'text' ? content : (type === 'image' ? '📷 Foto' : '🎤 Audio');
            updateConversationPreview(
                conversationId,
                previewText,
                serverMsgCreatedAt,
                false // Don't increment unread for own message
            );

            // Reload to show checkmark
            loadLocalMessages();

        } catch (err) {
            console.error('Failed to send message:', err);
            // Ideally mark as failed in DB, but for now just log
        }
    }, [conversationId, userId, loadLocalMessages]);

    // Retry sending pending messages
    const retryPending = useCallback(async () => {
        const pendingMsgs = messages.filter(m => m.status === 'pending');

        for (const msg of pendingMsgs) {
            try {
                const { message: serverMsg } = await chatService.sendMessage({
                    conversationId: msg.conversationId,
                    senderId: msg.senderId,
                    content: msg.content,
                    type: 'text',
                });

                // Update local message
                deleteLocalMessage(msg.id);
                saveMessage({
                    id: serverMsg.id,
                    serverId: serverMsg.id,
                    conversationId,
                    senderId: userId,
                    content: serverMsg.content,
                    type: 'text',
                    status: 'sent',
                    createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at,
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
            await chatService.editMessage(existingMsg.serverId || messageId, content, userId);

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
                await chatService.deleteMessage(existingMsg.serverId, userId);
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
        markMessagesAsRead,
    };
}
