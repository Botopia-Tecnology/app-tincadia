import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useTypingIndicator(conversationId: string, userId: string, userName: string) {
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [isTyping, setIsTypingState] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!conversationId || !userId) return;

        const channelId = `typing:${conversationId.toLowerCase()}`;
        const channel = supabase.channel(channelId, {
            config: {
                broadcast: { ack: false, self: false }
            }
        });

        channel
            .on('broadcast', { event: 'typing' }, (payload) => {
                const data = payload.payload;
                
                // Ignore our own typing events
                if (data.userId === userId) return;

                if (data.isTyping) {
                    setTypingUsers((prev) => {
                        if (!prev.includes(data.userName)) {
                            return [...prev, data.userName];
                        }
                        return prev;
                    });
                } else {
                    setTypingUsers((prev) => prev.filter((u) => u !== data.userName));
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
    }, [conversationId, userId, userName]);

    const setIsTyping = useCallback((typing: boolean) => {
        if (!channelRef.current) return;

        if (typing) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
            }, 3000);
        }

        if (isTyping === typing) return;

        if (channelRef.current.state !== 'joined') {
            return;
        }

        setIsTypingState(typing);
        
        channelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId, userName, isTyping: typing }
        }).catch((e) => {
            setIsTypingState(!typing); 
        });
    }, [userId, userName, isTyping]);

    return {
        typingUsers,
        setIsTyping,
    };
}
