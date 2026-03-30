/**
 * Chat Service
 * 
 * Handles all chat API calls to the backend.
 */

import { apiClient } from '../lib/api-client';
import { API_ENDPOINTS, API_URL } from '../config/api.config';
import { Message, Conversation, UserProfile, GroupParticipant, MessageMetadata } from '../types/chat.types';

export type { Message, Conversation, UserProfile, GroupParticipant, MessageMetadata };

interface SendMessageDto {
    conversationId: string;
    senderId: string;
    content: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'call' | 'call_ended';
    metadata?: MessageMetadata;
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
     * Get a user's profile (for viewing original registration name)
     */
    async getUserProfile(userId: string): Promise<UserProfile> {
        return apiClient(API_ENDPOINTS.USER_PROFILE(userId), {
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
     * Create a new group chat
     */
    async createGroup(data: { creatorId: string; title: string; participants: string[]; imageUrl?: string; description?: string }): Promise<{ conversationId: string }> {
        return apiClient(`${API_URL}/chat/groups`, { // Ensure direct path if endpoints config not updated
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
    async getMessages(conversationId: string, after?: string): Promise<{ messages: Message[] }> {
        let url = API_ENDPOINTS.CONVERSATION_MESSAGES(conversationId);
        if (after) {
            url += `?after=${encodeURIComponent(after)}`;
        }
        return apiClient(url, {
            method: 'GET',
        });
    },

    /**
     * Mark messages in a conversation as read
     */
    async markAsRead(conversationId: string, userId: string): Promise<{ success: boolean }> {
        return apiClient(API_ENDPOINTS.MESSAGES_READ, {
            method: 'POST',
            body: JSON.stringify({ conversationId, userId }),
        });
    },

    /**
     * Edit a message
     */
    async editMessage(messageId: string, content: string, userId: string): Promise<{ message: Message }> {
        return apiClient(API_ENDPOINTS.MESSAGE(messageId), {
            method: 'PUT',
            body: JSON.stringify({ content, userId }),
        });
    },

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        return apiClient(`${API_ENDPOINTS.MESSAGE(messageId)}?userId=${userId}`, {
            method: 'DELETE',
        });
    },

    /**
     * Convert text to speech
     */
    async textToSpeech(text: string): Promise<{ audioUrl: string }> {
        return apiClient('/model/tts', {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
    },

    /**
     * Correct a message text using AI
     */
    async correctMessage(text: string): Promise<{ correctedText: string }> {
        return apiClient(API_ENDPOINTS.CORRECT_TEXT, {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
    },

    /**
     * Correct a message text using AI with streaming (real-time updates)
     * Uses XMLHttpRequest because React Native doesn't support fetch ReadableStream
     */
    async correctMessageStream(
        text: string,
        onChunk: (partialText: string) => void
    ): Promise<string> {
        const url = `${API_URL}${API_ENDPOINTS.CORRECT_TEXT_STREAM}`;
        console.log('🔧 [CORRECTION] Starting stream correction');
        console.log('🔧 [CORRECTION] URL:', url);
        console.log('🔧 [CORRECTION] Text to correct:', text);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let fullText = '';
            let lastProcessedIndex = 0;

            xhr.open('POST', url, true);
            xhr.setRequestHeader('Content-Type', 'application/json');

            // Track progress for streaming
            xhr.onprogress = () => {
                const newData = xhr.responseText.substring(lastProcessedIndex);
                lastProcessedIndex = xhr.responseText.length;

                console.log('🔧 [CORRECTION] Progress data:', newData);

                const lines = newData.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        console.log('🔧 [CORRECTION] Data line:', data);

                        if (data === '[DONE]') {
                            console.log('🔧 [CORRECTION] Got [DONE]');
                            continue;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            console.log('🔧 [CORRECTION] Parsed:', parsed);

                            // Check if backend returned an error
                            if (parsed.error) {
                                console.error('🔧 [CORRECTION] Backend error:', parsed.error);
                                // Don't reject here, let it complete and show alert
                                return;
                            }

                            // Support both {chunk: "..."} and {text: "..."} formats
                            const textChunk = parsed.chunk || parsed.text || '';
                            if (textChunk) {
                                fullText += textChunk;
                                console.log('🔧 [CORRECTION] Updated fullText:', fullText);
                                onChunk(fullText);
                            }
                        } catch (parseError) {
                            // Ignore parse errors for incomplete chunks
                            console.log('🔧 [CORRECTION] Parse skipped:', line);
                        }
                    }
                }
            };

            xhr.onload = () => {
                console.log('🔧 [CORRECTION] XHR completed, status:', xhr.status);
                console.log('🔧 [CORRECTION] Final fullText:', fullText);

                if (xhr.status >= 200 && xhr.status < 300) {
                    // If no streaming happened, try to get the full response
                    if (!fullText && xhr.responseText) {
                        console.log('🔧 [CORRECTION] No streaming, parsing full response');
                        try {
                            // Try parsing as JSON (non-streaming fallback)
                            const json = JSON.parse(xhr.responseText);
                            fullText = json.correctedText || json.text || '';
                            if (fullText) {
                                onChunk(fullText);
                            }
                        } catch {
                            // Try parsing SSE format from full response
                            const lines = xhr.responseText.split('\n');
                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    const data = line.slice(6).trim();
                                    if (data && data !== '[DONE]') {
                                        try {
                                            const parsed = JSON.parse(data);
                                            const chunk = parsed.chunk || parsed.text || '';
                                            if (chunk) {
                                                fullText += chunk;
                                            }
                                        } catch { }
                                    }
                                }
                            }
                            if (fullText) {
                                onChunk(fullText);
                            }
                        }
                    }
                    resolve(fullText);
                } else {
                    console.error('🔧 [CORRECTION] XHR error status:', xhr.status);
                    reject(new Error('Error en corrección streaming'));
                }
            };

            xhr.onerror = () => {
                console.error('🔧 [CORRECTION] XHR network error');
                reject(new Error('Error de red en corrección'));
            };

            xhr.send(JSON.stringify({ text }));
        });
    },
    async inviteInterpreters(data: { roomName: string; userId: string; username: string }): Promise<{ success: boolean; count?: number; message?: string }> {
        return apiClient('/chat/calls/interpreters', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    /**
     * Update interpreter busy status
     */
    async updateInterpreterStatus(userId: string, isBusy: boolean): Promise<{ success: boolean }> {
        return apiClient('/chat/interpreter/status', {
            method: 'POST',
            body: JSON.stringify({ userId, isBusy }),
        });
    },

    /**
     * Remove a participant from a group (Admin only)
     */
    async removeParticipant(conversationId: string, adminId: string, userIdToRemove: string): Promise<{ success: boolean }> {
        return apiClient('/chat/groups/remove', {
            method: 'POST',
            body: JSON.stringify({ conversationId, adminId, userIdToRemove }),
        });
    },

    /**
     * Add a participant to a group (Admin only)
     */
    async addParticipant(conversationId: string, adminId: string, userIdToAdd: string): Promise<{ success: boolean }> {
        return apiClient('/chat/groups/add', {
            method: 'POST',
            body: JSON.stringify({ conversationId, adminId, userIdToAdd }),
        });
    },

    /**
     * Promote a participant to administrator (Admin only)
     */
    async promoteToAdmin(conversationId: string, adminId: string, userIdToPromote: string): Promise<{ success: boolean }> {
        return apiClient('/chat/groups/promote', {
            method: 'POST',
            body: JSON.stringify({ conversationId, adminId, userIdToPromote }),
        });
    },

    /**
     * Leave a group
     */
    async leaveGroup(conversationId: string, userId: string): Promise<{ success: boolean }> {
        return apiClient('/chat/groups/leave', {
            method: 'POST',
            body: JSON.stringify({ conversationId, userId }),
        });
    },

    /**
     * Update group information (Admin only)
     */
    async updateGroup(data: { conversationId: string; adminId: string; title?: string; imageUrl?: string; description?: string }): Promise<{ group: Group }> {
        return apiClient('/chat/groups', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    /**
     * Get participants of a group
     */
    async getGroupParticipants(conversationId: string): Promise<GroupParticipant[]> {
        return apiClient(`/chat/groups/${conversationId}/participants`, {
            method: 'GET',
        });
    },

    /**
     * Start the AI Transcription agent for a room
     */
    async startTranscription(roomName: string): Promise<{ success: boolean; message?: string }> {
        // Assuming the Model-ms is exposed via /model path in API Gateway
        // If Model-ms is separate, full URL might be needed, but trying gateway relative path first
        return apiClient('/model/transcribe', {
            method: 'POST',
            body: JSON.stringify({ room_name: roomName }),
        });
    },

    /**
     * Stop the AI Transcription agent for a room
     */
    async stopTranscription(roomName: string): Promise<{ success: boolean; message?: string }> {
        return apiClient('/model/transcribe/stop', {
            method: 'POST',
            body: JSON.stringify({ room_name: roomName }),
        });
    },
};
