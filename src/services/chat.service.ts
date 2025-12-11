/**
 * Chat Service
 * 
 * Handles all chat API calls to the backend.
 */

import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS } from '../config/api.config';

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'audio';
    createdAt: string;
    isRead: boolean;
}

export interface Conversation {
    id: string;
    participants: string[];
    otherUserId: string;
    otherUserName?: string;
    otherUserAvatar?: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
}

interface SendMessageDto {
    conversationId: string;
    senderId: string;
    content: string;
    type?: 'text' | 'image' | 'audio';
}

interface CreateConversationDto {
    userId: string;
    otherUserId: string;
}

export interface AvailableUser {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
}

export const chatService = {
    /**
     * Get all available users to chat with (excludes current user)
     */
    async getAvailableUsers(currentUserId: string): Promise<{ users: AvailableUser[] }> {
        return apiClient(API_ENDPOINTS.AVAILABLE_USERS(currentUserId), {
            method: 'GET',
        });
    },

    /**
     * Start or get existing conversation with another user
     */
    async startConversation(userId: string, otherUserId: string): Promise<{ conversationId: string }> {
        return apiClient(API_ENDPOINTS.CONVERSATIONS, {
            method: 'POST',
            body: JSON.stringify({ userId, otherUserId }),
        });
    },

    /**
     * Create a new conversation (legacy - use startConversation instead)
     */
    async createConversation(data: CreateConversationDto): Promise<{ conversation: Conversation }> {
        return apiClient(API_ENDPOINTS.CONVERSATIONS, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    /**
     * Get all conversations for a user
     */
    async getConversations(userId: string): Promise<{ conversations: Conversation[] }> {
        return apiClient(API_ENDPOINTS.USER_CONVERSATIONS(userId), {
            method: 'GET',
        });
    },

    /**
     * Send a message
     */
    async sendMessage(data: SendMessageDto): Promise<{ message: Message }> {
        return apiClient(API_ENDPOINTS.MESSAGES, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    /**
     * Get messages for a conversation
     */
    async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
        return apiClient(API_ENDPOINTS.CONVERSATION_MESSAGES(conversationId), {
            method: 'GET',
        });
    },

    /**
     * Mark messages as read
     */
    async markAsRead(messageIds: string[]): Promise<void> {
        return apiClient(API_ENDPOINTS.MESSAGES_READ, {
            method: 'POST',
            body: JSON.stringify({ messageIds }),
        });
    },

    /**
     * Edit a message
     */
    async editMessage(messageId: string, content: string): Promise<{ message: Message }> {
        return apiClient(API_ENDPOINTS.MESSAGE(messageId), {
            method: 'PUT',
            body: JSON.stringify({ content }),
        });
    },

    /**
     * Delete a message
     */
    async deleteMessage(messageId: string): Promise<void> {
        return apiClient(API_ENDPOINTS.MESSAGE(messageId), {
            method: 'DELETE',
        });
    },
};
