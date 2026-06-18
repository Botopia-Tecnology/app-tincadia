import { useState, useEffect, useRef } from 'react';
import { Platform, DeviceEventEmitter, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import { CallState } from '../lib/callState';
import { authService } from '../services/auth.service';
import { supabase } from '../lib/supabase';
import { User } from '../types/auth.types';
import { NavigationParams } from '../types/navigation.types';
import { callKeepService } from '../services/callkeep.service';
import { chatService } from '../services/chat.service';
import { saveMessage, updateConversationPreview, deleteMessage } from '../database/chatDatabase';

/** Realtime/API payloads may use snake_case or camelCase; UUIDs may differ in casing. */
function isSameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function getStringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > 0 ? text : undefined;
}

export const useNotifications = (user: User | null, onNavigateToChat: (params: NavigationParams) => void, onNavigateToCall: (params: NavigationParams) => void) => {
  const [interpreterInvite, setInterpreterInvite] = useState<{
    roomName: string;
    senderId: string;
    senderName: string;
    inviteId?: string;
  } | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const activeCallRef = useRef<string | null>(null);
  const activeIncomingCallRef = useRef<string | null>(null);

  const clearNativeCallUi = (payload: Record<string, unknown>) => {
    const callUUID = getStringValue(payload.callUUID);
    const conversationId = getStringValue(payload.conversationId);
    const roomName = getStringValue(payload.roomName);
    console.log('[PUSH_DEBUG] clearNativeCallUi called', { callUUID, conversationId });

    // VERY IMPORTANT: Emit this FIRST so CallScreen knows to close immediately
    // without waiting for CallKeep or failing if CallKeep throws.
    DeviceEventEmitter.emit('external_call_ended', {
      callUUID,
      conversationId,
      roomName,
    });

    const idsToEnd = Array.from(new Set([
      callUUID,
      conversationId,
      roomName,
    ].filter(Boolean))) as string[];

    if (activeIncomingCallRef.current && idsToEnd.includes(activeIncomingCallRef.current)) {
      idsToEnd.push(activeIncomingCallRef.current);
    }

    activeIncomingCallRef.current = null;

    idsToEnd.forEach((id) => {
      try {
        callKeepService.dismissIncomingCall(id);
      } catch (error) {
        console.warn('[useNotifications] Could not end native call UI:', id, error);
      }
    });

    Notifications.dismissAllNotificationsAsync().catch(() => { });
  };

  useEffect(() => {
    if (!user) return;

    // 1. Register for Standard Expo Push Notifications (for Chat Messages)
    const registerForPush = async () => {
      if (!Device.isDevice) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });

        // Agregado el canal incoming_calls para notificaciones de llamadas / intérpretes
        await Notifications.setNotificationChannelAsync('incoming_calls', {
          name: 'Llamadas Entrantes',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: '#FF231F7C',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
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
        if (token) {
          await authService.updatePushToken(user.id, token);
        }
      }
    };
    registerForPush().catch(e => {
      console.error('[PUSH_REGISTER] Failed to register push token:', e);
    });

    // 2. Register for VoIP Push (iOS)
    if (Platform.OS === 'ios') {
      callKeepService.setupVoipPush((token) => {
        authService.updateVoipToken(user.id, token).catch(console.error);
      });
    }

    // 3. Register for FCM Data Messages (Android VoIP)
    if (Platform.OS === 'android') {
      messaging().getToken()
        .then(token => {
          console.log('✅ FCM Token generated:', token ? token.substring(0, 15) + '...' : 'null');
          if (token) {
            authService.updateFcmToken(user.id, token).catch(e => console.error('Error updating FCM token:', e));
          }
        })
        .catch(error => {
          console.error('❌ Error getting FCM token:', error);
        });

      // Listen for token refreshes
      const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
        console.log('🔄 FCM Token refreshed:', token ? token.substring(0, 15) + '...' : 'null');
        if (token) {
          authService.updateFcmToken(user.id, token).catch(console.error);
        }
      });

      // Handle FCM Data messages in foreground
      const unsubscribeFCM = messaging().onMessage(async remoteMessage => {
        const data = remoteMessage.data;
        if (data?.type === 'call') {
          const senderId = getStringValue(data.senderId || data.sender_id);
          if (isSameUserId(senderId, user.id)) {
            console.log('[useNotifications] Ignoring own incoming-call push');
            return;
          }

          const callUUID = getStringValue(data.callUUID || data.roomName || data.conversationId);
          if (!callUUID) return;

          if (activeIncomingCallRef.current === callUUID) {
            console.log('[useNotifications] Ignoring duplicate incoming-call push (already ringing).');
            return;
          }

          // AVOID HUAWEI/EMUI QUEUED MESSAGE BUG:
          // If the message was delayed by the OS and is older than 30 seconds, ignore it.
          const now = Date.now();
          const sentTime = remoteMessage.sentTime || now;
          if (now - sentTime > 30000) {
            console.log('[useNotifications] FCM call message is too old (delayed by OS), ignoring.');
            return;
          }

          if (activeCallRef.current) {
            console.log('[useNotifications] Ignoring incoming-call push while already in a call:', activeCallRef.current);
            clearNativeCallUi(data);
            return;
          }

          if (CallState.isInsideCallScreen) {
            console.log('[useNotifications] Ignoring incoming-call push because user is already inside CallScreen.');
            return;
          }

          if (activeIncomingCallRef.current && activeIncomingCallRef.current !== callUUID) {
            try {
              callKeepService.endCall(activeIncomingCallRef.current);
            } catch {
              // The previous native call UI may already be gone.
            }
          }

          const handle = String(data.senderName || 'Tincadia');
          activeIncomingCallRef.current = callUUID;
          callKeepService.displayIncomingCall(callUUID, handle, handle);

          const convIdStr = getStringValue(data.conversationId);
          if (convIdStr) {
            DeviceEventEmitter.emit('chat_sync_requested', convIdStr);
            DeviceEventEmitter.emit('chat_local_update', convIdStr);
          }
        } else if (data?.type === 'call_ended' || data?.type === 'call_missed' || data?.type === 'call_rejected') {
          clearNativeCallUi(data);

          const conversationId = getStringValue(data.conversationId);
          if (conversationId) {
            DeviceEventEmitter.emit('chat_sync_requested', conversationId);
            DeviceEventEmitter.emit('chat_local_update', conversationId);
          }
        }
      });

      return () => {
        unsubscribeFCM();
        unsubscribeTokenRefresh();
      };
    }
  }, [user]);

  // 4. Handle Expo Push Notification responses (for chat and interpreter invites)
  useEffect(() => {
    if (!user) return;

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => { });

      if (data?.type === 'call_invite' && data?.roomName) {
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

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      if (data?.type === 'call_invite' && data?.roomName && data?.senderId) {
        if (user.role === 'interpreter') {
          setInterpreterInvite({
            roomName: String(data.roomName),
            senderId: String(data.senderId),
            senderName: String(data.senderName || 'Usuario'),
            inviteId: data.inviteId ? String(data.inviteId) : undefined,
          });
        }
      } else if (data?.type === 'call_invite_taken') {
        setInterpreterInvite(null);
        Notifications.dismissAllNotificationsAsync().catch(() => { });
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [user, onNavigateToCall, onNavigateToChat]);

  // 5. Handle Realtime Supabase Broadcasts (fast cancellation)
  useEffect(() => {
    if (!user) return;
    const userChannel = supabase
      .channel(`user:${user.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const data = payload.payload;
        console.log('📡 [useNotifications] Broadcast incoming_call received:', data);
        if (data && data.senderId !== user.id) {
          if (CallState.isInsideCallScreen) {
            console.log('[useNotifications] Ignoring incoming_call broadcast because user is already inside CallScreen.');
            return;
          }
          const callUUID = data.roomName || data.conversationId;
          if (callUUID) {
            if (activeIncomingCallRef.current === callUUID) {
              console.log('[useNotifications] Ignoring duplicate incoming_call broadcast (already ringing).');
              return;
            }
            const handle = data.senderName || 'Tincadia';
            activeIncomingCallRef.current = callUUID;
            callKeepService.displayIncomingCall(callUUID, handle, handle);
          }
        }
      })
      .on('broadcast', { event: 'call_ended' }, (payload) => {
        const sm = payload.payload as any;
        const convId = String(sm?.conversationId || sm?.conversation_id || '');
        if (convId) {
          clearNativeCallUi({
            callUUID: sm?.callUUID || sm?.call_uuid,
            conversationId: convId,
            roomName: sm?.roomName || sm?.room_name,
          });

          const endMsgId = sm?.id || `call_end_local_${Date.now()}`;
          const localMsgs = require('../database/chatDatabase').getMessages(convId);
          const latestCall = [...localMsgs].reverse().find((m: any) => m.type === 'call');
          let markerTime = Date.now();
          if (latestCall && latestCall.createdAt) {
            const callTimeMs = new Date(latestCall.createdAt.replace(' ', 'T')).getTime();
            if (markerTime <= callTimeMs) {
              markerTime = callTimeMs + 1000;
            }
          }
          const safeCreatedAt = sm?.createdAt || sm?.created_at || new Date(markerTime).toISOString();

          const msgType = sm?.type || 'call_ended';
          let previewText = 'Llamada finalizada';
          if (msgType === 'call_rejected') previewText = 'Llamada rechazada';
          if (msgType === 'call_missed') previewText = 'Llamada perdida';

          const terminalMetadata = {
            ...(latestCall?.metadata || {}),
            ...((sm?.metadata && typeof sm.metadata === 'object') ? sm.metadata : {}),
            roomName: sm?.roomName || sm?.room_name || latestCall?.metadata?.roomName,
          };

          const hasTerminalMetadata = Object.keys(terminalMetadata).length > 0;

          saveMessage({
            id: endMsgId,
            serverId: sm?.id,
            conversationId: convId,
            senderId: sm?.senderId || 'system',
            content: sm?.content || previewText,
            type: msgType as any,
            status: 'sent',
            createdAt: safeCreatedAt,
            updatedAt: safeCreatedAt,
            isMine: false,
            metadata: hasTerminalMetadata ? terminalMetadata : undefined
          });

          updateConversationPreview(convId, previewText, safeCreatedAt, false);
          DeviceEventEmitter.emit('chat_local_update', convId);
        }
      })
      .on('broadcast', { event: 'call_invite_taken' }, () => {
        setInterpreterInvite(null);
        Notifications.dismissAllNotificationsAsync().catch(() => { });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user]);

  // 6. Handle CallKeep native 'answerCall' event to navigate to CallScreen
  useEffect(() => {
    if (!user) return;
    const sub = DeviceEventEmitter.addListener('CallKeep_AnswerCall', ({ callUUID }) => {
      // Limpiar la referencia antes de colgar nativamente para que el evento 'CallKeep_EndCall' no ejecute el rechazo local
      activeIncomingCallRef.current = null;
      
      // Cerrar la interfaz nativa ya que la app manejará la videollamada internamente
      try {
        callKeepService.endCallSilently(callUUID);
      } catch (e) {
        console.warn('Error terminando llamada nativa al contestar', e);
      }

      const realConvId = callUUID.startsWith('conv_') ? callUUID.replace('conv_', '') : callUUID;
      onNavigateToCall({
        roomName: callUUID,
        username: user.firstName || user.email?.split('@')[0] || 'Usuario',
        conversationId: realConvId,
        userId: user.id,
        isIncomingCall: true
      });
    });

    const subEnd = DeviceEventEmitter.addListener('CallKeep_EndCall', ({ callUUID }) => {
      console.log('Call ended internally via Native UI');
      if (activeIncomingCallRef.current === callUUID) {
        activeIncomingCallRef.current = null;

        // Extract real conversation ID
        const realConvId = callUUID.startsWith('conv_') ? callUUID.replace('conv_', '') : callUUID;

        // Lookup the latest call message for metadata
        const localMsgs = require('../database/chatDatabase').getMessages(realConvId);
        const latestCall = [...localMsgs].reverse().find((m: any) => m.type === 'call');
        const metadata = latestCall?.metadata;

        const tempId = `call_${Date.now()}`;
        const now = new Date().toISOString();

        // Optimistic UI update
        saveMessage({
          id: tempId,
          serverId: tempId,
          conversationId: realConvId,
          senderId: user.id,
          content: 'Llamada rechazada',
          type: 'call_ended',
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          isMine: true,
          metadata
        });
        updateConversationPreview(realConvId, 'Llamada rechazada', now, false);
        DeviceEventEmitter.emit('chat_local_update', realConvId);
        DeviceEventEmitter.emit('conversations_updated');

        // FAST BROADCAST REJECTION TO CHAT CHANNEL
        const channel = supabase.channel(`chat:${realConvId.toLowerCase()}`);
        let sent = false;
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && !sent) {
            sent = true;
            await channel.send({
              type: 'broadcast',
              event: 'call_ended',
              payload: {
                id: tempId,
                type: 'call_rejected',
                senderId: user.id,
                conversationId: realConvId,
                createdAt: now,
                roomName: metadata?.roomName || callUUID,
                callSessionId: metadata?.callSessionId,
              }
            });
            supabase.removeChannel(channel);
          }
        });

        // Tell the backend so it broadcasts to the caller to stop ringing
        chatService.sendMessage({
          conversationId: realConvId,
          senderId: user.id,
          content: 'Llamada rechazada',
          type: 'call_ended' as any,
          metadata
        }).then(({ message: serverMsg }) => {
          // Eliminar el mensaje optimista (tempId) para evitar duplicados en la UI local
          deleteMessage(tempId);
          // Replace temp message with server message
          saveMessage({
            id: serverMsg.id,
            serverId: serverMsg.id,
            conversationId: realConvId,
            senderId: user.id,
            content: 'Llamada rechazada',
            type: 'call_ended',
            status: 'sent',
            createdAt: (serverMsg as any).createdAt || (serverMsg as any).created_at || now,
            updatedAt: now,
            isMine: true,
            metadata
          });
          DeviceEventEmitter.emit('chat_local_update', realConvId);
        }).catch(console.warn);
      }
    });

    return () => {
      sub.remove();
      subEnd.remove();
    };
  }, [user, onNavigateToCall]);

  return {
    interpreterInvite,
    setInterpreterInvite,
    incomingCall: null,
    setIncomingCall: (_val: any) => { },
    setActiveCall: (value: string | null) => {
      activeCallRef.current = value;
      if (value && activeIncomingCallRef.current === value) {
        activeIncomingCallRef.current = null;
      }
    }
  };
};
