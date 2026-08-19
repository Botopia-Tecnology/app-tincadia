import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform, DeviceEventEmitter, AppState, AppStateStatus, Keyboard, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import { CallState, HANDOFF_ACTIVE_CALL_EVENT } from '../lib/callState';
import { authService } from '../services/auth.service';
import { supabase } from '../lib/supabase';
import { User } from '../types/auth.types';
import { NavigationParams } from '../types/navigation.types';
import { callKeepService } from '../services/callkeep.service';
import { chatService } from '../services/chat.service';
import { saveMessage, updateConversationPreview, deleteMessage, getMessages } from '../database/chatDatabase';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getConversationIdFromRoomName(roomName?: string): string | undefined {
  if (!roomName?.startsWith('conv_')) return undefined;
  const conversationId = roomName.replace(/^conv_/, '');
  return conversationId.length > 0 ? conversationId : undefined;
}

function getLatestLocalCallMetadata(conversationId?: string) {
  if (!conversationId) return undefined;

  try {
    const localMsgs = getMessages(conversationId);
    return [...localMsgs]
      .reverse()
      .find((message: any) => message.type === 'call')?.metadata as
      | { roomName?: string; callSessionId?: string; call_session_id?: string }
      | undefined;
  } catch (error) {
    console.warn('[useNotifications] Could not read local call metadata:', error);
    return undefined;
  }
}

function asSafeRoomName(value?: string, nativeCallUUID?: string): string | undefined {
  if (!value) return undefined;
  if (UUID_REGEX.test(value)) return undefined;
  if (nativeCallUUID && value.toLowerCase() === nativeCallUUID.toLowerCase()) return undefined;
  return value;
}

export const useNotifications = (user: User | null, onNavigateToChat: (params: NavigationParams) => void, onNavigateToCall: (params: NavigationParams) => void, onNavigateHome?: () => void) => {
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
  const lastInviteKeyRef = useRef<string | null>(null);

  const isInterpreter = useCallback(() => {
    return String(user?.role || '').toLowerCase() === 'interpreter';
  }, [user?.role]);

  /**
   * Solicitud de intérprete: SOLO Expo/UI in-app (IncomingCallModal).
   * Nunca CallKeep / CallKit / módulo nativo de llamadas.
   */
  const showInterpreterInvite = useCallback((raw: {
    roomName?: unknown;
    room_name?: unknown;
    senderId?: unknown;
    sender_id?: unknown;
    senderName?: unknown;
    sender_name?: unknown;
    inviteId?: unknown;
    invite_id?: unknown;
  }, opts?: { presentLocalBanner?: boolean }) => {
    if (!user || !isInterpreter()) return false;

    const roomName = getStringValue(raw.roomName || raw.room_name);
    const senderId = getStringValue(raw.senderId || raw.sender_id);
    if (!roomName || !senderId) return false;

    const inviteId = getStringValue(raw.inviteId || raw.invite_id);
    const senderName = getStringValue(raw.senderName || raw.sender_name) || 'Usuario';
    const inviteKey = `${inviteId || ''}:${roomName}:${senderId}`;

    // Evitar spam si Expo + broadcast llegan casi juntos.
    if (lastInviteKeyRef.current === inviteKey) {
      setInterpreterInvite({
        roomName,
        senderId,
        senderName,
        inviteId,
      });
      return true;
    }
    lastInviteKeyRef.current = inviteKey;

    setInterpreterInvite({
      roomName,
      senderId,
      senderName,
      inviteId,
    });

    try {
      Vibration.vibrate(Platform.OS === 'android' ? [0, 400, 200, 400] : 400);
    } catch {
      // ignore
    }

    // Banner Expo local solo como refuerzo in-app (p. ej. vía broadcast).
    // Si ya vino un push Expo remoto, no duplicar.
    if (opts?.presentLocalBanner && AppState.currentState === 'active') {
      Notifications.scheduleNotificationAsync({
        content: {
          title: '📞 Solicitud de Intérprete',
          body: `${senderName} requiere un intérprete en una llamada.`,
          sound: true,
          data: {
            type: 'call_invite',
            inviteId,
            roomName,
            senderId,
            senderName,
          },
        },
        trigger: null,
      }).catch(() => { });
    }

    return true;
  }, [user, isInterpreter]);

  const resolveIncomingCallRouting = (payload: {
    callUUID?: string;
    roomName?: string;
    conversationId?: string;
    callSessionId?: string;
  }) => {
    const nativeCallUUID = payload.callUUID ? callKeepService.resolveCallUUID(payload.callUUID) : undefined;
    const nativeContext = payload.callUUID ? callKeepService.getIncomingCallContext(payload.callUUID) : undefined;
    const mappedConversationId = payload.callUUID ? CallState.getIncomingCallConversationId(payload.callUUID) : undefined;

    const conversationId =
      payload.conversationId ||
      nativeContext?.conversationId ||
      mappedConversationId ||
      getConversationIdFromRoomName(payload.roomName) ||
      getConversationIdFromRoomName(nativeContext?.roomName);

    const latestCallMetadata = getLatestLocalCallMetadata(conversationId);
    const roomName =
      asSafeRoomName(payload.roomName, nativeCallUUID) ||
      asSafeRoomName(nativeContext?.roomName, nativeCallUUID) ||
      asSafeRoomName(latestCallMetadata?.roomName, nativeCallUUID) ||
      (conversationId ? `conv_${conversationId}` : undefined);

    return {
      nativeCallUUID,
      conversationId,
      roomName,
      callSessionId:
        payload.callSessionId ||
        nativeContext?.callSessionId ||
        latestCallMetadata?.callSessionId ||
        latestCallMetadata?.call_session_id,
    };
  };

  const isIncomingForCurrentActiveCall = (payload: {
    callUUID?: unknown;
    nativeCallUUID?: unknown;
    roomName?: unknown;
    conversationId?: unknown;
    callSessionId?: unknown;
    call_session_id?: unknown;
  }) => {
    const conversationId = getStringValue(payload.conversationId);
    const roomName = getStringValue(payload.roomName);
    const callSessionId = getStringValue(payload.callSessionId || payload.call_session_id);
    const callUUID = getStringValue(payload.callUUID || payload.nativeCallUUID);
    const activeConversationId = activeCallRef.current;

    return Boolean(
      (activeConversationId && conversationId && activeConversationId.toLowerCase() === conversationId.toLowerCase()) ||
      CallState.matchesActiveCallScreen({
        callUUID,
        nativeCallUUID: callUUID,
        roomName,
        conversationId,
        callSessionId,
      })
    );
  };

  const navigateToAnsweredIncomingCall = (routing: ReturnType<typeof resolveIncomingCallRouting>) => {
    const params = {
      roomName: routing.roomName,
      username: user?.firstName || user?.email?.split('@')[0] || 'Usuario',
      conversationId: routing.conversationId,
      userId: user?.id,
      callSessionId: routing.callSessionId,
      isIncomingCall: true,
      nativeCallUUID: routing.nativeCallUUID,
    };

    const isDifferentFromActiveCall =
      !CallState.matchesActiveCallScreen({
        roomName: routing.roomName,
        conversationId: routing.conversationId,
        callSessionId: routing.callSessionId,
        nativeCallUUID: routing.nativeCallUUID,
      }) &&
      Boolean(
        CallState.isInsideCallScreen ||
        (activeCallRef.current && routing.conversationId && activeCallRef.current.toLowerCase() !== routing.conversationId.toLowerCase())
      );

    if (!isDifferentFromActiveCall) {
      onNavigateToCall(params);
      return;
    }

    console.log('[useNotifications] Handoff requested: ending active app call before joining answered incoming call.', {
      currentConversationId: activeCallRef.current,
      nextConversationId: routing.conversationId,
      nextRoomName: routing.roomName,
      nextCallSessionId: routing.callSessionId,
    });

    DeviceEventEmitter.emit(HANDOFF_ACTIVE_CALL_EVENT, {
      roomName: routing.roomName,
      conversationId: routing.conversationId,
      callSessionId: routing.callSessionId,
      nativeCallUUID: routing.nativeCallUUID,
    });

    setTimeout(() => {
      onNavigateToCall(params);
    }, 450);
  };

  const clearNativeCallUi = (payload: Record<string, unknown>) => {
    const callUUID = getStringValue(payload.callUUID);
    const conversationId = getStringValue(payload.conversationId);
    const roomName = getStringValue(payload.roomName);
    const callSessionId = getStringValue(payload.callSessionId || (payload.metadata as Record<string, unknown> | undefined)?.callSessionId);
    console.log('[PUSH_DEBUG] clearNativeCallUi called', { callUUID, conversationId });

    // VERY IMPORTANT: Emit this FIRST so CallScreen knows to close immediately
    // without waiting for CallKeep or failing if CallKeep throws.
    DeviceEventEmitter.emit('external_call_ended', {
      callUUID,
      conversationId,
      roomName,
      callSessionId,
    });

    const idsToEnd = Array.from(new Set([
      callUUID,
      conversationId,
      roomName,
      activeIncomingCallRef.current,
    ].filter(Boolean))) as string[];
    CallState.clearIncomingCall(conversationId || roomName || callUUID || activeIncomingCallRef.current);
    activeIncomingCallRef.current = null;
    DeviceEventEmitter.emit('chat_local_update', conversationId || roomName || callUUID);

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

    let cancelled = false;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeFCM: (() => void) | undefined;

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
        if (token && !cancelled) {
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
        if (token && !cancelled) {
          void authService.updateVoipToken(user.id, token).catch(console.error);
        }
      });
    }

    // 3. Register for FCM Data Messages (Android VoIP)
    if (Platform.OS === 'android') {
      messaging().getToken()
        .then(token => {
          console.log('✅ FCM Token generated:', token ? token.substring(0, 15) + '...' : 'null');
          if (token && !cancelled) {
            void authService.updateFcmToken(user.id, token).catch(console.error);
          }
        })
        .catch(error => {
          console.error('❌ Error getting FCM token:', error);
        });

      // Listen for token refreshes
      unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
        console.log('🔄 FCM Token refreshed:', token ? token.substring(0, 15) + '...' : 'null');
        if (token && !cancelled) {
          void authService.updateFcmToken(user.id, token).catch(console.error);
        }
      });

      // Handle FCM Data messages in foreground
      unsubscribeFCM = messaging().onMessage(async remoteMessage => {
        const data = remoteMessage.data;

        if (data?.type === 'call') {
          const senderId = getStringValue(data.senderId || data.sender_id);
          if (isSameUserId(senderId, user.id)) {
            console.log('[useNotifications] Ignoring own incoming-call push');
            return;
          }

          const callUUID = getStringValue(data.callUUID || data.roomName || data.conversationId);
          if (!callUUID) return;
          const nativeCallUUID = callKeepService.resolveCallUUID(callUUID);

          if (activeIncomingCallRef.current === nativeCallUUID) {
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

          if (isIncomingForCurrentActiveCall(data)) {
            console.log('[useNotifications] Ignoring incoming-call push for the active call.');
            return;
          }

          if (activeIncomingCallRef.current && activeIncomingCallRef.current !== nativeCallUUID) {
            try {
              callKeepService.endCall(activeIncomingCallRef.current);
            } catch {
              // The previous native call UI may already be gone.
            }
          }

          const handle = String(data.senderName || 'Tincadia');
          activeIncomingCallRef.current = callKeepService.displayIncomingCall(callUUID, handle, handle, {
            roomName: getStringValue(data.roomName),
            conversationId: getStringValue(data.conversationId),
            callSessionId: getStringValue(data.callSessionId),
            senderId,
            senderName: handle,
          });

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

    }

    return () => {
      cancelled = true;
      unsubscribeFCM?.();
      unsubscribeTokenRefresh?.();
    };
  }, [user]);

  // 4. Handle Expo Push Notification responses (for chat and interpreter invites)
  useEffect(() => {
    if (!user) return;

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => { });

      if (data?.type === 'call_invite' && data?.roomName) {
        setInterpreterInvite(null);
        lastInviteKeyRef.current = null;

        const baseName = user.firstName || user.email?.split('@')[0] || 'Usuario';
        const joinCall = () => onNavigateToCall({
          roomName: String(data.roomName),
          // Mismo formato de identity que el modal in-app: el backend usa el
          // prefijo "Intérprete:" para aplicar la regla de un intérprete por llamada.
          username: isInterpreter() ? `Intérprete: ${baseName}` : baseName,
          conversationId: String(data.roomName),
          userId: user.id
        });

        // Tocar la notificación debe pasar por el mismo claim atómico que el
        // modal: si otro intérprete ya tomó la llamada, avisar y no entrar.
        // Solo Expo / Claim — nunca CallKeep.
        const inviteId = data.inviteId ? String(data.inviteId) : undefined;
        if (isInterpreter() && inviteId) {
          chatService.claimInterpreterInvite(inviteId, user.id)
            .then((result) => {
              if (result.success) {
                joinCall();
              } else {
                Alert.alert('Llamada ocupada', result.message || 'Esta sala ya se encuentra ocupada por otro intérprete.', [{ text: 'Entendido', onPress: onNavigateHome }]);
              }
            })
            .catch(() => {
              Alert.alert('Error', 'No se pudo procesar la solicitud de intérprete.');
            });
        } else if (isInterpreter()) {
          chatService.updateInterpreterStatus(user.id, true).catch(() => { });
          joinCall();
        } else {
          joinCall();
        }
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
      if (data?.type === 'call_invite') {
        // Push Expo en foreground: abrir modal in-app (sin CallKeep).
        // presentLocalBanner=false porque el propio push ya muestra banner vía handler.
        showInterpreterInvite(data, { presentLocalBanner: false });
      } else if (data?.type === 'call_invite_taken') {
        setInterpreterInvite(null);
        lastInviteKeyRef.current = null;
        Notifications.dismissAllNotificationsAsync().catch(() => { });
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [user, onNavigateToCall, onNavigateToChat, onNavigateHome, isInterpreter, showInterpreterInvite]);

  // 5. Handle Realtime Supabase Broadcasts (fast cancellation)
  useEffect(() => {
    if (!user) return;
    const userChannel = supabase
      .channel(`user:${user.id}`)
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const data = payload.payload;
        console.log('📡 [useNotifications] Broadcast incoming_call received:', data);
        if (data && data.senderId !== user.id) {
          if (Platform.OS === 'ios') {
            // iOS primary path is PushKit/CallKit. This is only a foreground/app-alive fallback:
            // if the VoIP push is delayed or missing, the user still gets a native incoming UI.
            setTimeout(() => {
              const conversationId = getStringValue(data.conversationId);
              if (isIncomingForCurrentActiveCall(data)) {
                console.log('[useNotifications] iOS fallback skipped: incoming call already matches active CallScreen.');
                return;
              }
              if (conversationId && CallState.hasIncomingCall(conversationId)) {
                console.log('[useNotifications] iOS fallback skipped: PushKit already registered incoming call.');
                return;
              }

              const callUUID = data.nativeCallUUID || data.callUUID || data.uuid || data.roomName || data.conversationId;
              if (!callUUID) return;

              const nativeCallUUID = callKeepService.resolveCallUUID(String(callUUID));
              if (activeIncomingCallRef.current === nativeCallUUID) {
                console.log('[useNotifications] iOS fallback skipped: already ringing.');
                return;
              }
              if (activeIncomingCallRef.current && activeIncomingCallRef.current !== nativeCallUUID) {
                try {
                  callKeepService.endCall(activeIncomingCallRef.current);
                } catch {
                  // The previous native call UI may already be gone.
                }
              }

              const handle = String(data.senderName || 'Tincadia');
              activeIncomingCallRef.current = callKeepService.displayIncomingCall(String(callUUID), handle, handle, {
                roomName: getStringValue(data.roomName),
                conversationId,
                callSessionId: getStringValue(data.callSessionId || data.call_session_id),
                senderId: getStringValue(data.senderId || data.sender_id),
                senderName: getStringValue(data.senderName),
              });
            }, 800);
            return;
          }

          if (isIncomingForCurrentActiveCall(data)) {
            console.log('[useNotifications] Ignoring incoming_call broadcast for the active call.');
            return;
          }
          const callUUID = data.callUUID || data.roomName || data.conversationId;
          if (callUUID) {
            const nativeCallUUID = callKeepService.resolveCallUUID(String(callUUID));
            if (activeIncomingCallRef.current === nativeCallUUID) {
              console.log('[useNotifications] Ignoring duplicate incoming_call broadcast (already ringing).');
              return;
            }
            if (activeIncomingCallRef.current && activeIncomingCallRef.current !== nativeCallUUID) {
              try {
                callKeepService.endCall(activeIncomingCallRef.current);
              } catch {
                // The previous native call UI may already be gone.
              }
            }
            const handle = String(data.senderName || 'Tincadia');
            activeIncomingCallRef.current = callKeepService.displayIncomingCall(String(callUUID), handle, handle, {
              roomName: getStringValue(data.roomName),
              conversationId: getStringValue(data.conversationId),
              callSessionId: getStringValue(data.callSessionId),
              senderId: getStringValue(data.senderId),
              senderName: getStringValue(data.senderName),
            });
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
            callSessionId: sm?.callSessionId || sm?.call_session_id || sm?.metadata?.callSessionId,
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
      .on('broadcast', { event: 'call_invite' }, (payload) => {
        const data = payload.payload;
        // Fallback in-app vía Realtime (sin CallKeep). Si Expo push ya llegó,
        // showInterpreterInvite deduplica por inviteKey.
        showInterpreterInvite(data, { presentLocalBanner: true });
      })
      .on('broadcast', { event: 'call_invite_taken' }, () => {
        setInterpreterInvite(null);
        lastInviteKeyRef.current = null;
        Notifications.dismissAllNotificationsAsync().catch(() => { });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
    };
  }, [user, showInterpreterInvite]);

  // 6. Reconcile state when returning to foreground. Supabase sockets and JS
  // timers die in background, so terminal call events can be lost entirely;
  // pushes only clean the native UI, never the local data state.
  useEffect(() => {
    if (!user) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;

      // Keyboard.dismiss() calls made while the CallKit UI had the app
      // inactive are no-ops; iOS restores the keyboard on return to active.
      if (CallState.isInsideCallScreen) {
        Keyboard.dismiss();
      }

      // Drop "incoming call" markers older than any possible ring window.
      // Also dismiss the native side: stale CallKeep aliases/displayed UUIDs
      // make displayIncomingCall silently skip every future call in the
      // conversation ("Ignoring duplicate displayIncomingCall").
      CallState.getStaleIncomingConversationIds().forEach((conversationId) => {
        console.log('[useNotifications] Clearing stale incoming-call marker for conversation:', conversationId);
        try {
          callKeepService.dismissIncomingCall(conversationId);
        } catch {
          // No native call left for this conversation.
        }
        CallState.clearIncomingCall(conversationId);
      });

      // Pull anything missed while the realtime socket was suspended.
      DeviceEventEmitter.emit('chat_sync_requested');
    });

    return () => sub.remove();
  }, [user]);

  // 7. Handle CallKeep native 'answerCall' event to navigate to CallScreen
  useEffect(() => {
    if (!user) return;
    const sub = DeviceEventEmitter.addListener('CallKeep_AnswerCall', ({ callUUID, roomName, conversationId, callSessionId }) => {
      const routing = resolveIncomingCallRouting({ callUUID, roomName, conversationId, callSessionId });

      if (!routing.roomName || !routing.conversationId) {
        console.warn('[useNotifications] Refusing to navigate answered native call without canonical room context.', {
          callUUID,
          roomName,
          conversationId,
          callSessionId,
          resolved: routing,
        });
        return;
      }

      // Clear the reference before ending native UI so CallKeep_EndCall does not reject the call locally.
      activeIncomingCallRef.current = null;

      if (Platform.OS === 'android') {
        // Android: backToForeground ya trajo la app al frente; la UI nativa sobra.
        try {
          callKeepService.endCallSilently(callUUID);
        } catch (e) {
          console.warn('Error terminando llamada nativa al contestar', e);
        }
      }
      // iOS: la app no puede traerse al foreground por sí misma. La llamada
      // CallKit debe seguir viva tras contestar: es lo que hace que iOS abra la
      // app (llamada con video) y mantenga JS + sesión de audio corriendo en
      // background mientras LiveKit conecta. CallScreen la cierra al desmontar
      // (endAllCallsSilently) y el botón nativo de colgar ya llega vía
      // CallKeep_EndCall con wasInsideCallScreen.

      CallState.clearIncomingCall(routing.conversationId);
      navigateToAnsweredIncomingCall(routing);
    });

    const subEnd = DeviceEventEmitter.addListener('CallKeep_EndCall', ({ callUUID, roomName, conversationId, callSessionId }) => {
      console.log('Call ended internally via Native UI');
      const routing = resolveIncomingCallRouting({ callUUID, roomName, conversationId, callSessionId });
      if (activeIncomingCallRef.current === routing.nativeCallUUID) {
        activeIncomingCallRef.current = null;

        if (!routing.roomName || !routing.conversationId) {
          console.warn('[useNotifications] Refusing to reject native call without canonical room context.', {
            callUUID,
            roomName,
            conversationId,
            callSessionId,
            resolved: routing,
          });
          return;
        }

        const resolvedRoomName = routing.roomName;
        const realConvId = routing.conversationId;
        CallState.clearIncomingCall(realConvId);

        // Lookup the latest call message for metadata
        const localMsgs = getMessages(realConvId);
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
                roomName: metadata?.roomName || resolvedRoomName,
                callSessionId: metadata?.callSessionId || callSessionId,
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
          metadata: metadata || {
            roomName: resolvedRoomName,
            callSessionId,
          }
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
    clearInterpreterInvite: () => {
      setInterpreterInvite(null);
      lastInviteKeyRef.current = null;
    },
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
