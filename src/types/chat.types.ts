import { User } from './auth.types';

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'call' | 'call_ended' | 'call_rejected' | 'call_missed';
    createdAt: string;
    isRead: boolean;
    metadata?: MessageMetadata;
    senderName?: string;
    isSynced?: boolean;
    replyToContent?: string;
    replyToSender?: string;
}

export interface MessageMetadata {
    duration?: number;
    publicId?: string;
    width?: number;
    height?: number;
    thumbnailUrl?: string;
    fileName?: string;
    mimeType?: string;
    fileSize?: number;
    /** Transcripción de nota de voz (Vosk) */
    transcription?: string;
    /** Nota de video circular estilo WhatsApp */
    isVideoNote?: boolean;
    /** True when the user (or remote) actually edited message body */
    wasEdited?: boolean;
    /** Mensaje de actividad del grupo (centrado en el hilo) */
    isSystem?: boolean;
    systemEvent?: string;
    [key: string]: unknown;
}

export interface Conversation {
    id: string;
    participants: string[];
    otherUserId: string;
    otherUserName?: string;
    otherUserPhone?: string;
    otherUserAvatar?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
    type?: 'direct' | 'group';
    isGroup?: boolean;
    title?: string;
    imageUrl?: string;
    description?: string;
    adminId?: string;
    isUnknown?: boolean;
}

export interface UserProfile {
    user?: User & {
        firstName?: string;
        lastName?: string;
        first_name?: string; // Support for backend snake_case
        last_name?: string;  // Support for backend snake_case
    };
    profile?: {
        bio?: string;
        location?: string;
        [key: string]: unknown;
    };
}

export interface DatabaseConversation {
    id: string;
    other_user_id: string | null;
    other_user_name: string;
    other_user_avatar: string;
    other_user_phone: string;
    last_message: string;
    last_message_at: string;
    unread_count: number;
    updated_at: string;
    type: string | null;
    title: string | null;
    image_url: string | null;
    description: string | null;
}

export interface DatabaseMessage {
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
    reply_to_id: string | null;
    reply_to_content: string | null;
    reply_to_sender: string | null;
    metadata: string | null;
}

export interface DatabaseContact {
    id: string;
    owner_id: string;
    contact_user_id: string;
    phone: string;
    alias: string;
    custom_first_name: string;
    custom_last_name: string;
    updated_at: string;
    avatar_url?: string | null;
}

export interface GroupParticipant extends User {
    role?: 'admin' | 'member';
    joinedAt?: string;
}

export interface Group {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    adminId: string;
    participants: string[];
}

