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

/** Realtime/API payloads may use snake_case or camelCase; UUIDs may differ in casing. */
function isSameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
}

export interface Message {
    id: string;
    serverId?: string;
    conversationId: string;
    senderId: string;
    senderName?: string;
    content: string;
    type: string;
    status: MessageStatus;
    createdAt: string;
    updatedAt?: string;
    readAt?: string;
    deletedAt?: string;
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

/**
 * Interface for server message response (supports both snake_case from DB and camelCase from DTOs)
 */
interface ServerMessage {
    id: string;
    conversationId?: string;
    conversation_id?: string;
    senderId?: string;
    sender_id?: string;
    content: string;
    type?: string;
    createdAt?: string;
    created_at?: string;
    updatedAt?: string;
    updated_at?: string;
    readAt?: string;
    read_at?: string;
    deletedAt?: string;
    deleted_at?: string;
    replyToId?: string;
    reply_to_id?: string;
    replyToContent?: string;
    reply_to_content?: string;
    replyToSender?: string;
    reply_to_sender?: string;
    metadata?: MessageMetadata;
}

export function useChat(
    conversationId: string, 
    userId: string, 
    options?: { readReceiptsEnabled?: boolean; isGroup?: boolean }
): UseChatReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isSyncingRef = useRef(false);
    const channelRef = useRef<RealtimeChannel | null>(null);
    const senderNameMapRef = useRef<Map<string, string>>(new Map());
    const recentBroadcastIdsRef = useRef<Set<string>>(new Set());

    // Transform LocalMessage to UI Message
    const transformMessage = useCallback((m: LocalMessage): Message => ({
        id: m.id,
        serverId: m.serverId,
        conversationId: m.conversationId,
        senderId: m.senderId,
        senderName: m.senderName,
        content: m.content,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
        readAt: m.readAt,
        deletedAt: m.deletedAt,
        isMine: m.isMine,
        replyToId: m.replyToId,
        replyToContent: m.replyToContent,
        replyToSender: m.replyToSender,
        metadata: m.metadata,
    }), []);

    const resolveSenderName = useCallback((senderId: string): string | undefined => {
        return senderNameMapRef.current.get(senderId);
    }, []);

    const loadGroupParticipants = useCallback(async () => {
        if (!options?.isGroup) return;
        try {
            const participants = await chatService.getGroupParticipants(conversationId);
            const nameMap = new Map<string, string>();
            participants.forEach((p) => {
                const name = `${p.firstName || (p as any).first_name || ''} ${p.lastName || (p as any).last_name || ''}`.trim();
                if (name && p.id) {
                    nameMap.set(p.id, name);
                }
            });
            senderNameMapRef.current = nameMap;
        } catch (err) {
            console.error('Error loading group participants:', err);
        }
    }, [conversationId, options?.isGroup]);

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
                    const m = msg as ServerMessage;
                    const msgCreatedAt = m.createdAt || m.created_at;
                    return msgCreatedAt && msgCreatedAt > lastTimestamp;
                })
                : serverMessages;

            if (newMessages.length > 0) {
                console.log('📥 Got', newMessages.length, 'new messages');
            }

            // Process all server messages (update existing or insert new)
            serverMessages.forEach((msg) => {
                const m = msg as ServerMessage;
                const msgConversationId = m.conversationId || m.conversation_id;
                const msgSenderId = m.senderId || m.sender_id;
                const msgCreatedAt = m.createdAt || m.created_at;
                const msgUpdatedAt = m.updatedAt || m.updated_at;
                const msgReadAt = m.readAt || m.read_at;
                const msgDeletedAt = m.deletedAt || m.deleted_at;
                const isMine = isSameUserId(msgSenderId, userId);

                // Determine status based on server data
                let status: MessageStatus = 'sent';
                if (msgReadAt) {
                    status = 'read';
                } else if (!isMine) {
                    // Incoming message that we received = delivered from their perspective
                    status = 'delivered';
                }

                // Save to local DB
                if (msgConversationId && msgSenderId) {
                  const existing = getLocalMessages(conversationId).find(
                      (row) => row.id === msg.id || row.serverId === msg.id
                  );
                  // Server often bumps updated_at when only read_at changes (DB trigger).
                  // Same body → keep local updatedAt so "(editado)" does not show falsely.
                  let updatedAtForSave = msgUpdatedAt;
                  if (existing && existing.content === msg.content) {
                      updatedAtForSave = existing.updatedAt || msgCreatedAt || msgUpdatedAt;
                  }

                  let metaForSave = (msg.metadata || existing?.metadata) as MessageMetadata | undefined;
                  if (existing && existing.content !== msg.content) {
                      metaForSave = { ...(metaForSave || {}), wasEdited: true };
                  }

                  // Si el mensaje ya existe localmente como propio, preservar isMine:true
                  // para evitar el race-condition donde el sync lo sobrescribe como ajeno
                  const resolvedIsMine = existing?.isMine === true ? true : isMine;

                  saveMessage({
                      id: msg.id,
                      serverId: msg.id,
                      conversationId: msgConversationId,
                      senderId: msgSenderId,
                      senderName: resolveSenderName(msgSenderId),
                      content: msg.content,
                      type: msg.type || 'text',
                      status,
                      createdAt: msgCreatedAt || new Date().toISOString(),
                      updatedAt: updatedAtForSave,
                      readAt: msgReadAt,
                      deletedAt: msgDeletedAt,
                      isMine: resolvedIsMine,
                      replyToId: (m.replyToId || m.reply_to_id || msg.metadata?.replyToId) as string | undefined,
                      replyToContent: (m.replyToContent || m.reply_to_content || msg.metadata?.replyToContent) as string | undefined,
                      replyToSender: (m.replyToSender || m.reply_to_sender || msg.metadata?.replyToSender) as string | undefined,
                      metadata: metaForSave,
                  });
                }
            });

            if (newMessages.length > 0) {
                console.log('📥 Got', newMessages.length, 'new messages');

                // If there are new messages that are NOT mine, mark as read automatically
                const hasIncoming = newMessages.some((msg) => {
                    const m = msg as ServerMessage;
                    const msgSenderId = m.senderId || m.sender_id;
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
    }, [conversationId, userId, loadLocalMessages, resolveSenderName]);

    // Listen for local manual updates (fallback for instant UI like Call drops)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('chat_local_update', (updatedConvId) => {
            if (updatedConvId === conversationId) {
                loadLocalMessages();
            }
        });
        return () => sub.remove();
    }, [conversationId, loadLocalMessages]);

    // Mark messages as read: local + broadcast instant, API call direct
    const markMessagesAsRead = useCallback(async () => {
        // 1. Local cache: badge disappears immediately
        markConversationAsRead(conversationId);
        DeviceEventEmitter.emit('conversations_updated');

        if (options?.readReceiptsEnabled === false) return;

        // 2. Broadcast: sender sees blue ticks instantly
        if (channelRef.current && channelRef.current.state === 'joined') {
            channelRef.current.send({
                type: 'broadcast',
                event: 'message_read',
                payload: { conversationId, readerId: userId, timestamp: new Date().toISOString() },
            }).catch(() => {});
        }

        // 3. API call: sync server state
        try {
            await chatService.markAsRead(conversationId, userId);
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
                        const rawMsg = payload.new as Record<string, unknown>;
                        const msgId = rawMsg.id as string;
                        const msgSenderId = rawMsg.sender_id as string;
                        const isMine = isSameUserId(msgSenderId, userId);

                        // Si el sender soy yo, el optimistic update ya lo manejó correctamente.
                        // No guardar como isMine:false por ningún motivo.
                        if (isMine) {
                            // Solo limpiar el broadcast ref si existía
                            recentBroadcastIdsRef.current.delete(msgId);
                            return;
                        }

                        // If broadcast already handled this message, skip entirely
                        if (recentBroadcastIdsRef.current.has(msgId)) {
                            recentBroadcastIdsRef.current.delete(msgId);
                        } else {
                            // Save directly from postgres_changes payload for instant UI
                            const meta = rawMsg.metadata as Record<string, unknown> | undefined;
                            saveMessage({
                                id: msgId,
                                serverId: msgId,
                                conversationId: (rawMsg.conversation_id as string) || conversationId,
                                senderId: msgSenderId,
                                senderName: resolveSenderName(msgSenderId),
                                content: rawMsg.content as string,
                                type: (rawMsg.type as string) || 'text',
                                status: 'delivered',
                                createdAt: (rawMsg.created_at as string) || new Date().toISOString(),
                                updatedAt: rawMsg.updated_at as string | undefined,
                                isMine: false,
                                replyToId: (rawMsg.reply_to_id || meta?.replyToId) as string | undefined,
                                replyToContent: (rawMsg.reply_to_content || meta?.replyToContent) as string | undefined,
                                replyToSender: (rawMsg.reply_to_sender || meta?.replyToSender) as string | undefined,
                                metadata: meta as MessageMetadata | undefined,
                            });
                            loadLocalMessages();
                            markMessagesAsRead();
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const msg = payload.new as { read_at?: string; sender_id: string; id: string };
                        const updatedMsg = payload.new as any;

                        // Skip own edits/deletes — already handled optimistically
                        if (msg.sender_id === userId) {
                            if (updatedMsg.read_at) {
                                // read receipt from the other side, still update locally
                                const existing = getLocalMessages(conversationId).find(m => m.id === msg.id || m.serverId === msg.id);
                                if (existing && existing.status !== 'read') {
                                    saveMessage({ ...existing, readAt: updatedMsg.read_at, status: 'read' as MessageStatus });
                                    loadLocalMessages();
                                }
                            }
                        } else if (updatedMsg.content || updatedMsg.updated_at) {
                            console.log(`✏️ Message ${updatedMsg.id} updated via DB, updating UI`);
                            const existing = getLocalMessages(conversationId).find(m => m.id === updatedMsg.id || m.serverId === updatedMsg.id);
                            if (existing) {
                                const newContent = updatedMsg.content || existing.content;
                                const contentChanged = newContent !== existing.content;
                                saveMessage({
                                    ...existing,
                                    content: newContent,
                                    updatedAt: updatedMsg.updated_at || existing.updatedAt,
                                    status: (updatedMsg.read_at) ? 'read' : (existing.status as MessageStatus),
                                    metadata: contentChanged
                                        ? { ...(existing.metadata || {}), wasEdited: true }
                                        : existing.metadata,
                                });
                                loadLocalMessages();
                            } else {
                                syncFromServer();
                            }
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
                    const sm = payload.payload as ServerMessage;
                    console.log('🚀 Broadcast [new_message] received:', sm?.id);

                    // Handle both snake_case (from DB) and camelCase (from sender broadcast)
                    const msgConversationId = sm?.conversationId || sm?.conversation_id;
                    const msgSenderId = sm?.senderId || sm?.sender_id;
                    const msgCreatedAt = sm?.createdAt || sm?.created_at;

                    if (sm && (msgConversationId as string)?.toLowerCase() === conversationId.toLowerCase() && msgSenderId !== userId) {
                        // Track this ID so the postgres_changes INSERT handler skips redundant work
                        recentBroadcastIdsRef.current.add(sm.id);
                        setTimeout(() => { recentBroadcastIdsRef.current.delete(sm.id); }, 10_000);

                        // 1. Save locally for instant rendering
                        const bMeta = sm.metadata as MessageMetadata | undefined;
                        saveMessage({
                            id: sm.id,
                            serverId: sm.id,
                            conversationId: msgConversationId as string,
                            senderId: msgSenderId as string,
                            senderName: resolveSenderName(msgSenderId as string),
                            content: sm.content,
                            type: sm.type || 'text',
                            status: 'delivered',
                            createdAt: msgCreatedAt as string,
                            isMine: false,
                            metadata: bMeta ? (bMeta as Record<string, unknown>) : undefined,
                        });
                        loadLocalMessages();

                        // 2. Mark as read — user is actively viewing this chat
                        markMessagesAsRead();
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'message_read' },
                (payload) => {
                    const readerId = (payload.payload as { readerId: string })?.readerId;
                    if (readerId && readerId !== userId) {
                        // 🚀 FAST-TRACK BLUE TICKS (ONLY FOR DIRECT CHATS)
                        // In group chats, one person reading doesn't mean all read.
                        // We wait for the backend to signal 'read_at' via postgres_changes.
                        if (options?.isGroup) {
                            console.log('👥 Group read receipt received, skipping fast-track');
                            return;
                        }

                        // 1. Update SQLite FIRST (synchronous)
                        const rows = getLocalMessages(conversationId);
                        rows.forEach(m => {
                            if (m.isMine && m.status !== 'read') {
                                updateMessageStatus(m.id, 'read');
                            }
                        });

                        // 2. Reload from SQLite so React state matches
                        loadLocalMessages();
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'message_deleted' },
                (payload) => {
                    const { messageId, deletedAt } = payload.payload as { messageId: string; deletedAt: string };
                    if (!messageId) return;
                    console.log('🗑️ Broadcast [message_deleted] received:', messageId);

                    const rows = getLocalMessages(conversationId);
                    const target = rows.find(m => m.id === messageId || m.serverId === messageId);
                    if (target) {
                        saveMessage({
                            ...target,
                            content: 'Mensaje eliminado',
                            updatedAt: deletedAt || new Date().toISOString(),
                            deletedAt: deletedAt || new Date().toISOString(),
                        });
                        loadLocalMessages();
                    }
                }
            )
            .on(
                'broadcast',
                { event: 'message_updated' },
                (payload) => {
                    const { messageId, content, updatedAt } = payload.payload as { messageId: string; content: string; updatedAt: string };
                    if (!messageId) return;
                    console.log('✏️ Broadcast [message_updated] received:', messageId);

                    const rows = getLocalMessages(conversationId);
                    const target = rows.find(m => m.id === messageId || m.serverId === messageId);
                    if (target) {
                        saveMessage({
                            ...target,
                            content: content || target.content,
                            updatedAt: updatedAt || new Date().toISOString(),
                            metadata: { ...(target.metadata || {}), wasEdited: true },
                        });
                        loadLocalMessages();
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
        markMessagesAsRead();

        // 3. Load group participants for sender name resolution, then sync
        const init = async () => {
            await loadGroupParticipants();
            await syncFromServer();
        };
        init();

        // 4. Poll as fail-safe in case Realtime misses events (rare)
        pollingIntervalRef.current = setInterval(() => {
            syncFromServer();
        }, 120_000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [conversationId, userId, loadLocalMessages, syncFromServer, markMessagesAsRead, loadGroupParticipants]);

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
            metadata: metadata as Record<string, unknown> | undefined,
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

            const sm = serverMsg as ServerMessage;
            const serverMsgConvId = sm.conversationId || sm.conversation_id || conversationId;
            const serverMsgSenderId = sm.senderId || sm.sender_id || userId;
            const serverMsgCreatedAt = sm.createdAt || sm.created_at || now;

            const mergedMetadata: Record<string, unknown> = {
                ...(metadata as Record<string, unknown>),
                ...((sm.metadata || {}) as Record<string, unknown>),
            };
            const hasMetaKeys = Object.keys(mergedMetadata).length > 0;

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
                replyToId: (sm.replyToId || sm.reply_to_id || metadata?.replyToId) as string | undefined,
                replyToContent: (sm.replyToContent || sm.reply_to_content || metadata?.replyToContent) as string | undefined,
                replyToSender: (sm.replyToSender || sm.reply_to_sender || metadata?.replyToSender) as string | undefined,
                metadata: hasMetaKeys ? mergedMetadata : undefined,
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
                        isMine: false,
                        metadata: hasMetaKeys ? mergedMetadata : undefined,
                    },
                });
            }

            // Update conversation preview in local DB (optimistic list update)
            // This ensures ChatsScreen shows the new message at the top immediately
            const previewText = type === 'text' ? content : (type === 'image' ? 'Foto' : 'Audio');
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

    // Edit a message (WhatsApp style)
    const editMessage = useCallback(async (messageId: string, content: string) => {
        const existingMsg = messages.find(m => m.id === messageId || m.serverId === messageId);
        if (!existingMsg) return;

        const originalContent = existingMsg.content;
        const localNow = new Date().toISOString();
        const editedMeta = { ...(existingMsg.metadata || {}), wasEdited: true };

        // Optimistic: update React state AND SQLite immediately
        setMessages(prev => prev.map(m =>
            (m.id === messageId || m.serverId === messageId)
                ? { ...m, content, updatedAt: localNow, metadata: editedMeta }
                : m
        ));
        saveMessage({
            ...existingMsg,
            content,
            updatedAt: localNow,
            status: existingMsg.status as MessageStatus,
            metadata: editedMeta,
        });

        try {
            const { message: serverMsg } = await chatService.editMessage(existingMsg.serverId || messageId, content, userId);
            const sm = serverMsg as ServerMessage;

            saveMessage({
                ...existingMsg,
                content: serverMsg.content,
                updatedAt: sm.updated_at || sm.updatedAt || localNow,
                serverId: serverMsg.id,
                status: existingMsg.status as MessageStatus,
                metadata: editedMeta,
            });
            loadLocalMessages();

            if (channelRef.current && channelRef.current.state === 'joined') {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'message_updated',
                    payload: { messageId: serverMsg.id, content: serverMsg.content, updatedAt: sm.updated_at }
                });
            }
        } catch (err) {
            console.error('Error editing message:', err);
            setError('Error al editar mensaje');
            // Revert optimistic change
            saveMessage({
                ...existingMsg,
                content: originalContent,
                status: existingMsg.status as MessageStatus,
            });
            loadLocalMessages();
        }
    }, [messages, loadLocalMessages, userId]);

    // Delete a message
    const deleteMessage = useCallback(async (messageId: string) => {
        const existingMsg = messages.find(m => m.id === messageId || m.serverId === messageId);

        if (!existingMsg) return;

        const originalContent = existingMsg.content;
        const localNow = new Date().toISOString();

        // Optimistic: update React state immediately (zero delay UI)
        setMessages(prev => prev.map(m =>
            (m.id === messageId || m.serverId === messageId)
                ? { ...m, content: 'Mensaje eliminado', updatedAt: localNow, deletedAt: localNow }
                : m
        ));

        // Persist to SQLite in parallel (non-blocking for UI)
        saveMessage({
            ...existingMsg,
            content: 'Mensaje eliminado',
            updatedAt: localNow,
            deletedAt: localNow,
            status: existingMsg.status as MessageStatus,
        });

        try {
            if (existingMsg.serverId) {
                await chatService.deleteMessage(existingMsg.serverId, userId);

                if (channelRef.current && channelRef.current.state === 'joined') {
                    channelRef.current.send({
                        type: 'broadcast',
                        event: 'message_deleted',
                        payload: { messageId: existingMsg.serverId, deletedAt: localNow },
                    });
                }
            }
        } catch (err) {
            console.error('Error deleting message:', err);
            setError('Error al eliminar mensaje');
            // Revert optimistic change
            setMessages(prev => prev.map(m =>
                (m.id === messageId || m.serverId === messageId)
                    ? { ...m, content: originalContent, deletedAt: undefined }
                    : m
            ));
            saveMessage({
                ...existingMsg,
                content: originalContent,
                deletedAt: undefined,
                status: existingMsg.status as MessageStatus,
            });
        }
    }, [messages, userId]);

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
