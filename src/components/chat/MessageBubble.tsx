import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { messageBubbleStyles as styles } from '../../styles/ChatComponents.styles';
import { mediaService } from '../../services/media.service';
import { Ionicons } from '@expo/vector-icons';

interface MessageBubbleProps {
    content: string;
    time: string;
    isMine: boolean;
    isSynced?: boolean;
    isRead?: boolean;
    type?: string;
}

export function MessageBubble({ content, time, isMine, isSynced = true, isRead = false, type = 'text' }: MessageBubbleProps) {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadMedia = async () => {
            if (type === 'image' && content) {
                // If content starts with file:// it's a local uri (from sender side immediately)
                if (content.startsWith('file://')) {
                    setImageUri(content);
                    return;
                }

                // Otherwise it's a storage key. Check if we have it locally.
                try {
                    // Optimization: In a real app we would check cache first without full download attempt
                    // For now, downloadMedia checks existence
                    // But we want to trigger download only on tap? Or auto?
                    // Let's auto-load for now if it's small? 
                    // Or just show placeholder.

                    // BETTER: For sender, we sent the key. But wait, in ChatInput we optimistically sent localUri?
                    // In handleAttachment:
                    // onSend(storageKey, 'image', { localUri: ... })
                    // But useChat saves 'content' as 'storageKey'. 
                    // The 'metadata' is not currently persisted in basic implementation (I can add it if I want).

                    // If I am the sender, I might have it in local cache by the file name?
                    // mediaService.downloadMedia(key) checks existence.

                    // Let's try to load it silently.
                    // If not found, we show download button.
                } catch (e) {
                    // Ignore
                }
            }
        };
        loadMedia();
        return () => { isMounted = false; };
    }, [content, type]);

    const handleDownload = async () => {
        if (isLoadingImage) return;
        setIsLoadingImage(true);
        try {
            const uri = await mediaService.downloadMedia(content);
            setImageUri(uri);
        } catch (e) {
            console.error('Download failed', e);
        } finally {
            setIsLoadingImage(false);
        }
    };
    const formatTime = (dateString: string): string => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    // Render checkmarks for sent messages
    const renderCheckmarks = () => {
        if (!isMine) return null;

        if (!isSynced) {
            // Message not synced yet
            return <Text style={styles.pending}>⏳</Text>;
        }

        // Double checkmarks - color based on read status
        const checkmarkColor = isRead ? '#34B7F1' : 'rgba(255, 255, 255, 0.6)';
        return (
            <Text style={[styles.checkmarks, { color: checkmarkColor }]}>
                ✓✓
            </Text>
        );
    };

    return (
        <View style={[styles.container, isMine ? styles.containerMine : styles.containerOther]}>
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                {type === 'image' ? (
                    <View>
                        {imageUri ? (
                            <Image
                                source={{ uri: imageUri }}
                                style={{ width: 200, height: 200, borderRadius: 10 }}
                                resizeMode="cover"
                            />
                        ) : (
                            <TouchableOpacity onPress={handleDownload} style={{ width: 200, height: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 10 }}>
                                {isLoadingImage ? (
                                    <ActivityIndicator color={isMine ? 'white' : 'gray'} />
                                ) : (
                                    <>
                                        <Ionicons name="download-outline" size={32} color={isMine ? 'white' : 'gray'} />
                                        <Text style={{ color: isMine ? 'white' : 'gray', marginTop: 5 }}>Descargar Foto</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <Text style={[styles.content, isMine ? styles.contentMine : styles.contentOther]}>
                        {content}
                    </Text>
                )}
                <View style={styles.footer}>
                    <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
                        {formatTime(time)}
                    </Text>
                    {renderCheckmarks()}
                </View>
            </View>
        </View>
    );
}
