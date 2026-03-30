import { User } from './auth.types';

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'call' | 'call_ended';
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
    user?: User;
    profile?: {
        bio?: string;
        location?: string;
        [key: string]: unknown;
    };
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
