import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Vibration, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
import { supabase } from '../lib/supabase';
import { getLocalContacts, getConversation, LocalContact } from '../database/chatDatabase';
import { User } from '../types/auth.types';
import { NavigationParams } from '../types/navigation.types';
import { GroupParticipant } from '../types/chat.types';

interface CallParticipant {
  id: string;
  name: string;
  avatar?: string;
}

/**
 * Hook to handle all notification logic:
 * - Registration for push tokens
 * - Foreground notification listeners
 * - Notification response (tap) handlers
 * - Call and invite state management
 */
export const useNotifications = (user: User | null, onNavigateToChat: (params: NavigationParams) => void, onNavigateToCall: (params: NavigationParams) => void) => {
  const [incomingCall, setIncomingCall] = useState<{ 
    conversationId: string; 
    senderId: string; 
    callerName: string; 
    callerPhoto?: string; 
    participants?: CallParticipant[];
    roomName?: string;
  } | null>(null);
  
  const [interpreterInvite, setInterpreterInvite] = useState<{ 
    roomName: string; 
    senderId: string; 
    senderName: string;
    inviteId?: string;
  } | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const activeCallRef = useRef<string | null>(null);
  const endedCallsRef = useRef<Set<string>>(new Set());
  const lastPushTokenRef = useRef<string | null>(null);

  /**
   * Resolves the best caller name, photo and participants from local DB.
   * Used by both the foreground listener and the tap (response) listener
   * so the modal always shows complete info.
   */
  const resolveCallerInfo = useCallback(async (
    rawName: string,
    senderId: string,
    conversationId: string,
    userId: string
  ): Promise<{ callerName: string; callerPhoto?: string; participants: CallParticipant[] }> => {
    let callerName = rawName;
    let callerPhoto: string | undefined;
    let participants: CallParticipant[] = [];

    try {
      const localContacts = getLocalContacts(userId);
      const contact = localContacts.find((c: LocalContact) => c.contact_user_id === senderId);
      if (contact) {
        callerName = contact.alias || `${contact.custom_first_name || ''} ${contact.custom_last_name || ''}`.trim() || contact.phone;
      }

      const conversation = getConversation(conversationId);
      if (conversation) {
        callerPhoto = conversation.other_user_avatar || conversation.image_url || undefined;
        if (conversation.type === 'group') {
          if (conversation.title) callerName = conversation.title;
          const members = await chatService.getGroupParticipants(conversationId);
          if (members && Array.isArray(members)) {
            participants = members.map((m: GroupParticipant) => ({
              id: m.id,
              name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Usuario',
              avatar: m.avatarUrl
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error resolving caller info:', err);
    }

    return { callerName, callerPhoto, participants };
  }, []);

  const CALL_TTL_MS = 30_000;

  const isCallNotificationFresh = (notification: Notifications.Notification): boolean => {
    const receivedAt = notification.date;
    if (!receivedAt) return true;
    return (Date.now() - receivedAt) < CALL_TTL_MS;
  };

  const shouldIgnoreCallNotification = (
    data: Record<string, unknown>,
    notification: Notifications.Notification
  ): boolean => {
    if (String(data.senderId) === user?.id) return true;
    if (!isCallNotificationFresh(notification)) return true;
    const convId = String(data.conversationId || '');
    if (convId && endedCallsRef.current.has(convId)) return true;
    // Allow incoming calls even if already in a call — the modal will overlay
    return false;
  };

  useEffect(() => {
    if (!user) return;

    const registerForPush = async () => {
      if (!Device.isDevice) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('incoming_calls', {
          name: 'Incoming Calls',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
          lightColor: '#FF231F7C',
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus === 'granted') {
        const token = (await Notifications.getExpoPushTokenAsync({
          projectId: '8bf6b071-622c-4428-a2f8-b83b95fa2d99',
        })).data;
        
        if (token && token !== lastPushTokenRef.current) {
          await authService.updatePushToken(user.id, token);
          lastPushTokenRef.current = token;
          console.log('✅ Push Token Registered:', token);
        }
      }
    };

    registerForPush();

    const checkIfCallIsAlive = async (conversationId: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('type')
          .eq('conversation_id', conversationId)
          .in('type', ['call', 'call_ended', 'call_rejected'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (error || !data || data.length === 0) return true;
        return data[0].type === 'call';
      } catch (err) {
        return true;
      }
    };

    // ─────────────────────────────────────────────────────────────────────
    // BACKGROUND / KILLED APP RECOVERY
    // When the app was killed or in background and the user tapped a call
    // notification, Expo stores the last response. We check it once on mount
    // so the in-app modal shows immediately instead of nothing.
    // ─────────────────────────────────────────────────────────────────────
    const handleInitialNotification = async () => {
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (!lastResponse) return;

        const data = lastResponse.notification.request.content.data;

        // Always dismiss to prevent re-triggering
        await Notifications.dismissNotificationAsync(
          lastResponse.notification.request.identifier
        ).catch(() => {});

        if (data?.type === 'call' && data?.conversationId && data?.senderId) {
          if (shouldIgnoreCallNotification(data as Record<string, unknown>, lastResponse.notification)) {
            console.log('📞 Ignoring call notification from initial recovery (stale/self/active)');
            return;
          }

          // Validación extra: Verificar en Supabase si la llamada sigue viva para evitar "Phantom Calls"
          const isAlive = await checkIfCallIsAlive(String(data.conversationId));
          if (!isAlive) {
            console.log('📞 Phantom Call Blocked: Call is already ended in database.');
            Notifications.dismissAllNotificationsAsync().catch(() => {});
            return;
          }

          const { callerName, callerPhoto, participants } = await resolveCallerInfo(
            String(data.senderName || 'Usuario Tincadia'),
            String(data.senderId),
            String(data.conversationId),
            user.id
          );
          setIncomingCall({
            conversationId: String(data.conversationId),
            senderId: String(data.senderId),
            callerName,
            callerPhoto,
            participants,
            roomName: data.roomName ? String(data.roomName) : undefined,
          });
        } else if (data?.type === 'call_invite' && data?.roomName && data?.senderId) {
          if (user.role === 'interpreter') {
            setInterpreterInvite({
              roomName: String(data.roomName),
              senderId: String(data.senderId),
              senderName: String(data.senderName || 'Usuario'),
              inviteId: data.inviteId ? String(data.inviteId) : undefined,
            });
          }
        } else if (data?.conversationId && data?.senderId) {
          // Regular message notification tapped while killed
          onNavigateToChat({
            conversationId: String(data.conversationId),
            recipientId: String(data.senderId),
            isGroup: String(data.isGroup) === 'true',
            title: data.title ? String(data.title) : undefined,
          });
        }
      } catch (err) {
        console.error('Error handling initial notification:', err);
      }
    };

    handleInitialNotification();

    // ─────────────────────────────────────────────────────────────────────
    // FOREGROUND LISTENER
    // App is open and active — show in-app modal directly.
    // ─────────────────────────────────────────────────────────────────────
    notificationListener.current = Notifications.addNotificationReceivedListener(async notification => {
      const data = notification.request.content.data;

      if (data?.type === 'call' && data?.conversationId && data?.senderId) {
        if (shouldIgnoreCallNotification(data as Record<string, unknown>, notification)) {
          console.log('📞 Ignoring call notification in foreground (stale/self/active)');
          Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
          return;
        }
        const { callerName, callerPhoto, participants } = await resolveCallerInfo(
          String(data.senderName || notification.request.content.title || 'Usuario Tincadia'),
          String(data.senderId),
          String(data.conversationId),
          user.id
        );

        setIncomingCall({
          conversationId: String(data.conversationId),
          senderId: String(data.senderId),
          callerName,
          callerPhoto,
          participants,
          roomName: data.roomName ? String(data.roomName) : undefined,
        });
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      } else if (data?.type === 'call_invite' && data?.roomName && data?.senderId) {
        if (user.role === 'interpreter') {
          setInterpreterInvite({
            roomName: String(data.roomName),
            senderId: String(data.senderId),
            senderName: String(data.senderName || 'Usuario'),
            inviteId: data.inviteId ? String(data.inviteId) : undefined,
          });
        }
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      } else if (data?.type === 'call_invite_taken' || data?._action === 'dismiss_invite') {
        // Silent push: otro intérprete ya aceptó la llamada
        // Limpiar la invitación y cualquier notificación del cajón del sistema
        setInterpreterInvite(null);
        Notifications.dismissAllNotificationsAsync().catch(() => {});
        console.log('📞 Silent push: dismiss_invite recibido — limpiando invitaciones de intérprete');
      } else if (data?.type !== 'call_ended' && data?.type !== 'call_rejected') {
        Vibration.vibrate();
      }

      if (data?.type === 'call_ended' || data?.type === 'call_rejected') {
        const endedConvId = String(data?.conversationId || '');
        if (endedConvId) endedCallsRef.current.add(endedConvId);

        setIncomingCall(null);
        Notifications.dismissAllNotificationsAsync().catch(() => {});

        DeviceEventEmitter.emit('external_call_ended', { 
            conversationId: endedConvId,
            roomName: String(data?.roomName || data?.conversationId || '')
        });

        // Clean up after 60s so the Set doesn't grow indefinitely
        setTimeout(() => { endedCallsRef.current.delete(endedConvId); }, 60_000);
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // TAP LISTENER (Background → Foreground via notification tap)
    // User tapped the system notification while app was in background
    // (not killed). Show modal with full caller info.
    // ─────────────────────────────────────────────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data;

      // Always dismiss the tapped notification immediately
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});

      if (data?.type === 'call' && data?.conversationId && data?.senderId) {
        if (shouldIgnoreCallNotification(data as Record<string, unknown>, response.notification)) {
          console.log('📞 Ignoring call notification from tap (stale/self/active)');
          Notifications.dismissAllNotificationsAsync().catch(() => {});
          return;
        }

        // Extra safety: if a call_ended was already received for this conversation, block entry
        const tappedConvId = String(data.conversationId);
        if (endedCallsRef.current.has(tappedConvId)) {
          console.log('📞 Blocking ghost call — call already ended for', tappedConvId);
          Notifications.dismissAllNotificationsAsync().catch(() => {});
          return;
        }

        // Validación extra fuerte: Consultar DB en tiempo real al tocar la notificación
        const isAlive = await checkIfCallIsAlive(tappedConvId);
        if (!isAlive) {
          console.log('📞 Phantom Call Blocked: Call is already ended in database.');
          endedCallsRef.current.add(tappedConvId);
          Notifications.dismissAllNotificationsAsync().catch(() => {});
          return;
        }

        const { callerName, callerPhoto, participants } = await resolveCallerInfo(
          String(data.senderName || 'Usuario Tincadia'),
          String(data.senderId),
          String(data.conversationId),
          user.id
        );
        setIncomingCall({
          conversationId: String(data.conversationId),
          senderId: String(data.senderId),
          callerName,
          callerPhoto,
          participants,
          roomName: data.roomName ? String(data.roomName) : undefined,
        });
      } else if (data?.type === 'call_ended' || data?.type === 'call_rejected') {
        // User tapped a call_ended notification — just clean up, don't navigate
        setIncomingCall(null);
        Notifications.dismissAllNotificationsAsync().catch(() => {});
      } else if (data?.type === 'call_invite' && data?.roomName) {
        setInterpreterInvite(null);
        onNavigateToCall({
          roomName: String(data.roomName),
          username: user.firstName || user.email?.split('@')[0] || 'Usuario',
          conversationId: String(data.roomName),
          userId: user.id
        });
      } else if (data?.conversationId && data?.senderId) {
        onNavigateToChat({
          conversationId: String(data.conversationId),
          recipientId: String(data.senderId),
          isGroup: String(data.isGroup) === 'true',
          title: data.title ? String(data.title) : undefined
        });
      }
    });

    // Global user channel — receives real-time broadcasts for:
    // - call_ended: dismiss incoming call modal instantly (faster than push)
    // - call_invite_taken: dismiss interpreter invite when another accepts
    const userChannel = supabase
      .channel(`user:${user.id}`)
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const convId = String(payload.payload?.conversationId || '');
        console.log('🔴 Broadcast [call_ended] received for', convId);

        if (convId) endedCallsRef.current.add(convId);
        setIncomingCall(null);
        Notifications.dismissAllNotificationsAsync().catch(() => {});

        DeviceEventEmitter.emit('external_call_ended', {
          conversationId: convId,
          roomName: convId,
        });

        setTimeout(() => { endedCallsRef.current.delete(convId); }, 60_000);
      })
      .on('broadcast', { event: 'call_invite_taken' }, () => {
        setInterpreterInvite(null);
        Notifications.dismissAllNotificationsAsync().catch(() => {});
      })
      .subscribe();

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
      supabase.removeChannel(userChannel);
    };
  }, [user, resolveCallerInfo]);

  const setActiveCall = useCallback((conversationId: string | null) => {
    activeCallRef.current = conversationId;
  }, []);

  return {
    incomingCall,
    setIncomingCall,
    interpreterInvite,
    setInterpreterInvite,
    setActiveCall
  };
};
