/**
 * Chat Screen
 * 
 * Individual conversation view with messages.
 */

import React, { useRef, useEffect } from 'react';
import {
    View,
    FlatList,
    Text,
    StyleSheet,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useChat } from '../hooks/useChat';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { useAuth } from '../contexts/AuthContext';

interface ChatScreenProps {
    conversationId: string;
    otherUserName: string;
    onBack: () => void;
    isGroup?: boolean;
    otherUserId?: string; // Needed to check sender ID
}

export function ChatScreen({ conversationId, otherUserName, onBack, isGroup, otherUserId }: ChatScreenProps) {
    const { user } = useAuth();
    const userId = user?.id || '';
    const insets = useSafeAreaInsets();

    const { messages, sendMessage, isLoading, error } = useChat(conversationId, userId);
    const [messageText, setMessageText] = React.useState('');
    const flatListRef = useRef<FlatList>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages.length]);

    const handleSend = async (content: string) => {
        if (!content.trim()) return;
        await sendMessage(content);
        setMessageText('');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>← Atrás</Text>
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>
                    {otherUserName}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            {/* Error Message */}
            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
                {/* Loading State */}
                {isLoading && messages.length === 0 && (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#4CAF50" />
                    </View>
                )}

                {/* Empty State */}
                {!isLoading && messages.length === 0 && (
                    <View style={styles.center}>
                        <Text style={styles.emptyText}>No hay mensajes aún</Text>
                        <Text style={styles.emptySubtext}>¡Envía el primer mensaje!</Text>
                    </View>
                )}

                {/* Messages List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <MessageBubble
                            content={item.content}
                            time={item.createdAt}
                            isMine={item.isMine}
                            isSynced={item.status !== 'pending'}
                            // Show sender name ONLY for incoming messages in GROUPS (WhatsApp style)
                            senderName={!item.isMine && isGroup ? (item.senderId === otherUserId ? otherUserName : 'Miembro') : undefined}
                        />
                    )}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    showsVerticalScrollIndicator={false}
                />

                {/* Input */}
                <ChatInput 
                    onSend={() => handleSend(messageText)} 
                    messageText={messageText}
                    setMessageText={setMessageText}
                />
                {Platform.OS === 'ios' && <View style={{ height: insets.bottom, backgroundColor: '#FFFFFF' }} />}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F8F8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        paddingRight: 12,
    },
    backText: {
        fontSize: 16,
        color: '#4CAF50',
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: '#000000',
        textAlign: 'center',
    },
    headerSpacer: {
        width: 60,
    },
    content: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
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
    messageList: {
        paddingVertical: 16,
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
    },
});
