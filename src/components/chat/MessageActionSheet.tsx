/**
 * MessageActionSheet
 *
 * Bottom sheet that appears when the user long-presses a message.
 * Actions: Copy, Reply, Edit (own text msgs), Delete (own msgs)
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Pressable,
    Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../../hooks/useChat';

interface Props {
    message: Message | null;
    currentUserId: string;
    onClose: () => void;
    onReply: (msg: Message) => void;
    onEdit: (msg: Message) => void;
    onDelete: (msg: Message) => void;
}

interface Action {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    onPress: () => void;
}

export function MessageActionSheet({
    message,
    currentUserId,
    onClose,
    onReply,
    onEdit,
    onDelete,
}: Props) {
    if (!message) return null;

    const isOwn = message.senderId === currentUserId;
    const isText = message.type === 'text';

    const actions: Action[] = [
        // Copy — only for text messages
        ...(isText ? [{
            icon: 'copy-outline' as const,
            label: 'Copiar',
            color: '#E2E8F0',
            onPress: () => {
                Clipboard.setString(message.content);
                onClose();
            },
        }] : []),

        // Reply — always available
        {
            icon: 'arrow-undo-outline' as const,
            label: 'Responder',
            color: '#E2E8F0',
            onPress: () => {
                onReply(message);
                onClose();
            },
        },

        // Edit — only own text messages
        ...(isOwn && isText ? [{
            icon: 'pencil-outline' as const,
            label: 'Editar',
            color: '#93C5FD',
            onPress: () => {
                onEdit(message);
                onClose();
            },
        }] : []),

        // Delete — only own messages
        ...(isOwn ? [{
            icon: 'trash-outline' as const,
            label: 'Eliminar',
            color: '#FCA5A5',
            onPress: () => {
                onDelete(message);
                onClose();
            },
        }] : []),
    ];

    // Preview of message content
    const preview = message.type === 'text'
        ? message.content.slice(0, 60) + (message.content.length > 60 ? '…' : '')
        : message.type === 'image' ? '📷 Imagen'
        : message.type === 'audio' ? '🎤 Audio'
        : message.type === 'video' ? '🎥 Video'
        : message.content;

    return (
        <Modal
            visible={!!message}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
                    {/* Preview */}
                    <View style={styles.preview}>
                        <Text style={styles.previewText} numberOfLines={2}>
                            {preview}
                        </Text>
                    </View>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {actions.map((action) => (
                            <TouchableOpacity
                                key={action.label}
                                style={styles.actionItem}
                                onPress={action.onPress}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.iconWrap, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                                    <Ionicons name={action.icon} size={22} color={action.color} />
                                </View>
                                <Text style={[styles.actionLabel, { color: action.color }]}>
                                    {action.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Cancel */}
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                        <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: '#1E1E2E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 34,
        paddingTop: 12,
    },
    preview: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    previewText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontStyle: 'italic',
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        gap: 12,
    },
    actionItem: {
        alignItems: 'center',
        width: 72,
        gap: 6,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    cancelBtn: {
        marginHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.07)',
        alignItems: 'center',
    },
    cancelText: {
        color: '#E2E8F0',
        fontSize: 16,
        fontWeight: '600',
    },
});
