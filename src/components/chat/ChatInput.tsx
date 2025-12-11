/**
 * Chat Input Component
 * 
 * Text input for composing and sending messages.
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Escribe un mensaje...' }: ChatInputProps) {
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = async () => {
        const trimmedText = text.trim();
        if (!trimmedText || disabled || isSending) return;

        setIsSending(true);
        setText('');

        try {
            await onSend(trimmedText);
        } finally {
            setIsSending(false);
        }
    };

    const canSend = text.trim().length > 0 && !disabled && !isSending;

    return (
        <View style={styles.container}>
            <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                multiline
                maxLength={1000}
                editable={!disabled}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
            />

            <TouchableOpacity
                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!canSend}
            >
                {isSending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                    <Text style={styles.sendText}>Enviar</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 8,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 120,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        backgroundColor: '#F8F8F8',
    },
    sendButton: {
        marginLeft: 8,
        backgroundColor: '#4CAF50',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 70,
        height: 40,
    },
    sendButtonDisabled: {
        backgroundColor: '#CCCCCC',
    },
    sendText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
