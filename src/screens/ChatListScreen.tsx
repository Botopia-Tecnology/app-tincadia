/**
 * Chat List Screen
 * 
 * Displays list of conversations with real-time updates.
 */

import React, { useEffect } from 'react';
import {
    View,
    FlatList,
    Text,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useConversations } from '../hooks/useConversations';
import { ChatListItem } from '../components/chat/ChatListItem';
import { initChatDatabase } from '../database/chatDatabase';
import { useAuth } from '../contexts/AuthContext';

interface ChatListScreenProps {
    onSelectConversation: (conversationId: string, otherUserName: string) => void;
    onNavigate?: (screen: string) => void;
}

export function ChatListScreen({ onSelectConversation, onNavigate }: ChatListScreenProps) {
    const { user } = useAuth();
    const userId = user?.id || '';

    const { conversations, refresh, isLoading, error } = useConversations(userId);

    // Initialize database on mount
    useEffect(() => {
        initChatDatabase();
    }, []);

    const handleSelectConversation = (item: any) => {
        const conversationId = typeof item === 'string' ? item : item.id;
        const conversation = conversations.find(c => c.id === conversationId);
        onSelectConversation(conversationId, conversation?.otherUserName || 'Chat');
    };

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <Text style={styles.errorText}>Debes iniciar sesión</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Chats</Text>
            </View>

            {/* Error Message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            {/* Loading State */}
            {isLoading && conversations.length === 0 && (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#4CAF50" />
                    <Text style={styles.loadingText}>Cargando conversaciones...</Text>
                </View>
            )}

            {/* Empty State */}
            {!isLoading && conversations.length === 0 && (
                <View style={styles.center}>
                    <Text style={styles.emptyIcon}>💬</Text>
                    <Text style={styles.emptyText}>No tienes conversaciones</Text>
                    <Text style={styles.emptySubtext}>
                        Inicia un chat con alguien para comenzar
                    </Text>
                </View>
            )}

            {/* Conversations List */}
            <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <ChatListItem
                        item={{
                            id: item.id,
                            displayName: item.otherUserName,
                            avatarUrl: item.otherUserAvatar,
                            lastMessage: item.lastMessage,
                            lastMessageTime: item.lastMessageAt,
                            unreadCount: item.unreadCount,
                            type: 'unknown',
                            otherUserId: '',
                            phone: ''
                        }}
                        onPress={handleSelectConversation}
                        onLongPress={() => {}}
                        styles={styles}
                    />
                )}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={refresh}
                        colors={['#4CAF50']}
                        tintColor="#4CAF50"
                    />
                }
                contentContainerStyle={conversations.length === 0 ? styles.emptyList : undefined}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#000000',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666666',
    },
    errorContainer: {
        backgroundColor: '#FFE5E5',
        padding: 12,
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 8,
    },
    errorText: {
        color: '#CC0000',
        fontSize: 14,
        textAlign: 'center',
    },
    emptyList: {
        flexGrow: 1,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333333',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
});
