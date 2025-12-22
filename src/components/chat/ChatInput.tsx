/**
 * Chat Input Component
 * 
 * Text input for composing and sending messages.
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Animated } from 'react-native';
import { MagicPencilIcon } from '../icons/ActionIcons';
import { chatService } from '../../services/chat.service';
import { chatInputStyles as styles } from '../../styles/ChatComponents.styles';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ onSend, disabled = false, placeholder = 'Escribe un mensaje...' }: ChatInputProps) {
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [correctionOpacity] = useState(new Animated.Value(0));

    const handleCorrection = async () => {
        if (!text.trim() || isCorrecting || isSending) return;

        setIsCorrecting(true);
        try {
            const result = await chatService.correctMessage(text);
            if (result.correctedText !== text) {
                setText(result.correctedText);
                // Flash animation to indicate correction
                Animated.sequence([
                    Animated.timing(correctionOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(correctionOpacity, {
                        toValue: 0,
                        duration: 500,
                        delay: 300,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        } catch (error) {
            console.error('Text correction failed:', error);
        } finally {
            setIsCorrecting(false);
        }
    };

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
                editable={!disabled && !isCorrecting}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
            />

            {text.length > 0 && (
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={handleCorrection}
                    disabled={isCorrecting}
                >
                    {isCorrecting ? (
                        <ActivityIndicator size="small" color="#FF69B4" />
                    ) : (
                        // Debug: Simple square to test visibility
                        <View style={{ width: 24, height: 24, backgroundColor: '#FF69B4' }} />
                    )}
                </TouchableOpacity>
            )}

            <Animated.View
                style={[
                    styles.correctionOverlay,
                    { opacity: correctionOpacity }
                ]}
                pointerEvents="none"
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
