import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Platform, DeviceEventEmitter, AppState, AppStateStatus, Keyboard, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import messaging from '@react-native-firebase/messaging';
import { CallState, HANDOFF_ACTIVE_CALL_EVENT } from '../lib/callState';
import { authService } from '../services/auth.service';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types/auth.types';
import { NavigationParams } from '../types/navigation.types';
import { callKeepService } from '../services/callkeep.service';
import { chatService } from '../services/chat.service';
import { saveMessage, updateConversationPreview, deleteMessage, getMessages } from '../database/chatDatabase';
import { pendingCallActionStorage, pendingInviteStorage } from '../lib/secure-storage';

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

/**
 * Identity of an interpreter invite for dedup purposes. A cold-start replay and
 * the live Expo listener can both surface the same tap, and claiming twice would
 * make the second claim fail against the interpreter's own session.
 */
function inviteKeyOf(roomName?: string, inviteId?: string): string {
  return `${inviteId || ''}:${String(roomName || '').toLowerCase()}`;
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
  const consumedInviteKeysRef = useRef<Set<string>>(new Set());

  // Distinguishes "no session" from "session still being restored" — a
  // cold-start invite must survive the latter. useNotifications is always
  // rendered inside AuthProvider, so this is safe.
  const { isLoading: isAuthLoading } = useAuth();

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
    if (!user) {
      return;
    }

    let cancelled = false;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let unsubscribeFCM: (() => void) | undefined;


    // 1. Register for Standard Expo Push Notifications (for Chat Messages)
    const registerForPush = async () => {
      if (!Device.isDevice) {
        void authService.reportPushDiagnostic({
          reason: 'no_es_dispositivo', kind: 'expo', platform: Platform.OS,
        });
        return;
      }

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

      // Cada rama registra por que no hubo token: sin esto el fallo era mudo
      // (permiso denegado salia por el mismo camino que el exito) y el token
      // simplemente no aparecia en la base de datos, sin rastro en consola.
      const permissions = await Notifications.getPermissionsAsync();
      let finalStatus = permissions.status;
      const alreadyGranted = finalStatus === 'granted';

      if (!alreadyGranted) {
        // En iOS el dialogo solo se muestra una vez: si el permiso se nego
        // antes, esto devuelve 'denied' de inmediato sin preguntar nada, y
        // hay que reactivarlo desde Ajustes.
        if (!permissions.canAskAgain) {
          console.warn(
            '[PUSH_REGISTER] Permiso denegado permanentemente. El usuario debe activarlo en Ajustes del sistema.',
            { status: finalStatus, ios: permissions.ios?.status },
          );
          void authService.reportPushDiagnostic({
            reason: 'permiso_denegado_permanente',
            kind: 'expo',
            platform: Platform.OS,
            detail: `status=${finalStatus} ios=${permissions.ios?.status ?? 'n/a'}`,
          });
          return;
        }

        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }

      if (finalStatus !== 'granted') {
        console.warn('[PUSH_REGISTER] Sin permiso de notificaciones, no se genera Expo push token.', {
          status: finalStatus,
          previo: permissions.status,
          canAskAgain: permissions.canAskAgain,
        });
        void authService.reportPushDiagnostic({
          reason: 'permiso_denegado',
          kind: 'expo',
          platform: Platform.OS,
          detail: `status=${finalStatus} previo=${permissions.status} puedePreguntar=${permissions.canAskAgain}`,
        });
        return;
      }

      // Con el permiso concedido el token todavia puede fallar: credenciales
      // de APNs, projectId que no corresponde al build, o falta de
      // aps-environment. Se aisla para distinguirlo de un permiso denegado.
      // ANDROID: forzar el registro del dispositivo en FCM antes de pedir el
      // token a Expo.
      //
      // POST_NOTIFICATIONS y el registro FCM son cosas distintas y no van
      // sincronizadas. Al actualizar o reinstalar la app, Android CONSERVA el
      // permiso pero el registro FCM de esa instalacion queda sin inicializar:
      // el codigo veia "granted", se saltaba la solicitud, y getExpoPushToken
      // fallaba con SERVICE_NOT_AVAILABLE.
      //
      // Por eso el token solo aparecia tras "borrar datos": eso resetea el
      // permiso, se muestra el dialogo, y ese flujo si inicializa el registro.
      // Llamarlo explicitamente cubre el caso sin depender del dialogo.
      if (Platform.OS === 'android') {
        try {
          if (!messaging().isDeviceRegisteredForRemoteMessages) {
            await messaging().registerDeviceForRemoteMessages();
          }
        } catch (error) {
          // No es fatal: puede que ya estuviera registrado. Se sigue adelante y
          // el fallo real, si lo hay, saldra al pedir el token.
        }
      }

      // Reintentos: SERVICE_NOT_AVAILABLE es un error transitorio de Google
      // Play Services y Google lo documenta como reintentable. Observado en
      // pruebas: el mismo dispositivo fallaba dos veces y funcionaba a la
      // tercera en cuestion de segundos. Sin reintento, el usuario se queda sin
      // notificaciones hasta que vuelva a iniciar sesion.
      const esperar = (msDelay: number) => new Promise((r) => setTimeout(r, msDelay));
      const ESPERAS_MS = [0, 2000, 8000, 30000];

      let token: string | undefined;
      let ultimoError: unknown;

      for (let intento = 0; intento < ESPERAS_MS.length; intento++) {
        if (cancelled) return;
        if (ESPERAS_MS[intento] > 0) {
          await esperar(ESPERAS_MS[intento]);
          if (cancelled) return;
        }

        try {
          token = (await Notifications.getExpoPushTokenAsync({
            projectId: '8bf6b071-622c-4428-a2f8-b83b95fa2d99',
          })).data;
          ultimoError = undefined;
          break;
        } catch (error) {
          ultimoError = error;
        }
      }

      try {
        if (ultimoError) throw ultimoError;
      } catch (error) {
        console.error(
          '[PUSH_REGISTER] Permiso concedido pero getExpoPushTokenAsync fallo (revisar credenciales APNs/FCM y projectId):',
          error,
        );
        void authService.reportPushDiagnostic({
          reason: 'error_obtener_token',
          kind: 'expo',
          platform: Platform.OS,
          detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
        return;
      }

      if (!token) {
        console.warn('[PUSH_REGISTER] getExpoPushTokenAsync devolvio un token vacio.');
        void authService.reportPushDiagnostic({
          reason: 'token_vacio', kind: 'expo', platform: Platform.OS,
        });
        return;
      }

      if (cancelled) {
        return;
      }

      try {
        await authService.updatePushToken(user.id, token);
        console.log('[PUSH_REGISTER] Expo push token registrado:', token.substring(0, 25) + '...');
      } catch (error) {
        void authService.reportPushDiagnostic({
          reason: 'error_backend',
          kind: 'expo',
          platform: Platform.OS,
          detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        });
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
      // Mismo tratamiento que la ruta Expo: asegurar el registro del
      // dispositivo y reintentar ante SERVICE_NOT_AVAILABLE, que es
      // transitorio. Comparten la misma causa raiz porque en Android el token
      // de Expo se obtiene a traves de FCM.
      const obtenerTokenFcm = async (): Promise<string> => {
        const esperasFcm = [0, 2000, 8000, 30000];
        let ultimo: unknown;

        try {
          if (!messaging().isDeviceRegisteredForRemoteMessages) {
            await messaging().registerDeviceForRemoteMessages();
          }
        } catch {
          // No fatal: si ya estaba registrado o falla, lo dira getToken().
        }

        for (let i = 0; i < esperasFcm.length; i++) {
          if (cancelled) return '';
          if (esperasFcm[i] > 0) {
            await new Promise((r) => setTimeout(r, esperasFcm[i]));
            if (cancelled) return '';
          }
          try {
            return await messaging().getToken();
          } catch (e) {
            ultimo = e;
          }
        }
        throw ultimo;
      };

      obtenerTokenFcm()
        .then(token => {
          console.log('✅ FCM Token generated:', token ? token.substring(0, 15) + '...' : 'null');
          if (!token) return;
          if (cancelled) {
            return;
          }
          void authService.updateFcmToken(user.id, token).catch(console.error);
        })
        .catch(error => {
          console.error('❌ Error getting FCM token:', error);
          void authService.reportPushDiagnostic({
            reason: 'fcm_error',
            kind: 'fcm',
            platform: Platform.OS,
            detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          });
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

  /**
   * Tocar la notificación de solicitud de intérprete: claim atómico y entrada a
   * la sala. Compartido por el tap en caliente (listener de Expo) y por el tap
   * en frío (replay desde pendingInviteStorage), para que ambos caminos hagan
   * exactamente lo mismo — incluido avisar cuando otro intérprete ya la tomó.
   */
  const acceptInterpreterInviteFromTap = useCallback((raw: {
    roomName?: unknown;
    room_name?: unknown;
    inviteId?: unknown;
    invite_id?: unknown;
  }) => {
    if (!user) return;

    const roomName = getStringValue(raw.roomName || raw.room_name);
    if (!roomName) return;

    setInterpreterInvite(null);
    lastInviteKeyRef.current = null;

    const baseName = user.firstName || user.email?.split('@')[0] || 'Usuario';
    const joinCall = () => onNavigateToCall({
      roomName,
      // Mismo formato de identity que el modal in-app: el backend usa el
      // prefijo "Intérprete:" para aplicar la regla de un intérprete por llamada.
      username: isInterpreter() ? `Intérprete: ${baseName}` : baseName,
      conversationId: roomName,
      userId: user.id
    });

    const inviteId = getStringValue(raw.inviteId || raw.invite_id);
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
  }, [user, onNavigateToCall, onNavigateHome, isInterpreter]);

  // 4. Handle Expo Push Notification responses (for chat and interpreter invites)
  useEffect(() => {
    if (!user) return;

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => { });

      if (data?.type === 'call_invite' && data?.roomName) {
        // Tocar la notificación debe pasar por el mismo claim atómico que el
        // modal: si otro intérprete ya tomó la llamada, avisar y no entrar.
        // Solo Expo / Claim — nunca CallKeep.
        const inviteId = data.inviteId ? String(data.inviteId) : undefined;

        // Este tap llegó en caliente: descartar cualquier pendiente de arranque
        // en frío con el mismo invite para no reclamar la sala dos veces.
        if (consumedInviteKeysRef.current.has(inviteKeyOf(String(data.roomName), inviteId))) return;
        consumedInviteKeysRef.current.add(inviteKeyOf(String(data.roomName), inviteId));
        void pendingInviteStorage.clear();

        acceptInterpreterInviteFromTap(data);
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
  }, [user, onNavigateToChat, isInterpreter, showInterpreterInvite, acceptInterpreterInviteFromTap]);

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

              // Se resuelve primero por callSessionId: es el unico identificador
              // que comparten esta via (broadcast de Realtime) y el push FCM.
              // Sin esto cada una resolvia un UUID nativo distinto para la misma
              // llamada, sonaba dos veces y la segunda colgaba a la primera.
              const sessionId = getStringValue(data.callSessionId || data.call_session_id);
              const nativeCallUUID = sessionId
                ? callKeepService.resolveCallUUID(sessionId)
                : callKeepService.resolveCallUUID(String(callUUID));
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

      // Clear the reference before ending native UI so CallKeep_EndCall does not reject the call locally.
      activeIncomingCallRef.current = null;

      // ANDROID: retirar la UI nativa SIEMPRE, incluso si no se pudo resolver
      // el destino.
      //
      // Antes esto vivia despues de un `return` temprano: cuando el contexto no
      // se resolvia —lo habitual con la app en segundo plano o cerrada, porque
      // todas las fuentes (getIncomingCallContext, CallState,
      // getLatestLocalCallMetadata) son memoria del proceso y estan vacias— se
      // salia sin cerrar nada y la pantalla nativa se quedaba colgada encima
      // sin navegar a ningun sitio.
      //
      // En iOS no pasa porque CallKit retira su UI solo al contestar; ademas
      // alli la llamada debe seguir viva (es lo que trae la app al frente y
      // mantiene JS y el audio corriendo mientras LiveKit conecta).
      if (Platform.OS === 'android') {
        try {
          callKeepService.endCallSilently(callUUID);
        } catch (e) {
          console.warn('Error terminando llamada nativa al contestar', e);
        }
      }

      if (!routing.roomName || !routing.conversationId) {
        console.warn('[useNotifications] Sin contexto canonico para la llamada contestada; se intenta con la accion persistida.', {
          callUUID,
          roomName,
          conversationId,
          callSessionId,
          resolved: routing,
        });

        // Respaldo persistente: callkeep.service guarda la accion en
        // pendingCallActionStorage antes de emitir el evento, asi que sobrevive
        // a que la app estuviera cerrada. Sin esto el usuario se quedaba mirando
        // la pantalla nativa sin que pasara nada.
        void pendingCallActionStorage.get().then((pendiente) => {
          if (!pendiente || pendiente.type !== 'answer') return;

          const respaldo = resolveIncomingCallRouting({
            callUUID: pendiente.callUUID,
            roomName: pendiente.roomName,
            conversationId: pendiente.conversationId,
            callSessionId: pendiente.callSessionId,
          });

          if (!respaldo.roomName || !respaldo.conversationId) {
            console.warn('[useNotifications] La accion persistida tampoco resuelve el destino.');
            return;
          }

          CallState.clearIncomingCall(respaldo.conversationId);
          navigateToAnsweredIncomingCall(respaldo);
          void pendingCallActionStorage.clear();
        });
        return;
      }
      // iOS: la app no puede traerse al foreground por sí misma. La llamada
      // CallKit debe seguir viva tras contestar: es lo que hace que iOS abra la
      // app (llamada con video) y mantenga JS + sesión de audio corriendo en
      // background mientras LiveKit conecta. CallScreen la cierra al desmontar
      // (endAllCallsSilently) y el botón nativo de colgar ya llega vía
      // CallKeep_EndCall con wasInsideCallScreen.

      CallState.clearIncomingCall(routing.conversationId);
      void pendingCallActionStorage.clear();
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

  // A CallKeep answer can arrive through the Android headless task before
  // React mounts. Replay that action once authentication and this listener
  // are ready, then dismiss the native call UI.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const temporizadores: NodeJS.Timeout[] = [];

    // Ventana durante la cual una accion pendiente sigue siendo valida. Pasado
    // ese tiempo la llamada ya no existe y reproducirla seria abrir una sala
    // muerta.
    const VIGENCIA_ACCION_MS = 90_000;

    const intentarAccionPendiente = async () => {
      if (cancelled) return;
      const pending = await pendingCallActionStorage.get();
      if (cancelled || !pending) return;

      const routing = resolveIncomingCallRouting(pending);
      if (!routing.roomName || !routing.conversationId) {
        // NO se descarta si la accion todavia es reciente.
        //
        // Antes se borraba aqui mismo, y esa era la unica pista que quedaba: en
        // un arranque en frio este efecto puede correr antes de que el contexto
        // de la llamada este disponible, asi que el usuario contestaba, la app
        // abria, y la accion se descartaba para siempre sin navegar.
        //
        // Se conserva para que un render posterior —cuando el contexto ya se
        // resuelva— pueda completarla. Solo se descarta si caduco.
        const antiguedad = Date.now() - (pending.createdAt ?? 0);

        if (antiguedad > VIGENCIA_ACCION_MS) {
          console.warn(
            '[useNotifications] Se descarta la accion pendiente por antigua:',
            pending.callUUID,
          );
          void pendingCallActionStorage.clear();
        } else {
          console.warn(
            '[useNotifications] Aun sin destino para la accion pendiente; se conserva para reintentar.',
            { callUUID: pending.callUUID, antiguedadMs: antiguedad },
          );
        }
        return;
      }

      activeIncomingCallRef.current = null;
      try {
        callKeepService.endCallSilently(pending.callUUID);
      } catch (error) {
        console.warn('[useNotifications] Could not dismiss cold-start native call:', error);
      }
      void pendingCallActionStorage.clear();
      navigateToAnsweredIncomingCall(routing);
    };

    void intentarAccionPendiente();

    // Reintentos escalonados: en un arranque en frio el contexto de la llamada
    // (CallState, metadatos locales) puede tardar en estar disponible. Sin esto
    // el primer intento fallaba y no habia segunda oportunidad, asi que la app
    // abria sin entrar a la llamada. Se cortan solos en cuanto la accion se
    // consume o caduca.
    [800, 2000, 4000].forEach((retraso) => {
      temporizadores.push(setTimeout(() => void intentarAccionPendiente(), retraso));
    });

    return () => {
      cancelled = true;
      temporizadores.forEach(clearTimeout);
    };
  }, [user, onNavigateToCall]);

  // 9. Replay an interpreter invite whose notification tap launched the app.
  // index.ts captured it before React mounted; by the time we get here the
  // session is restored, so the claim can finally run.
  //
  // The entry is only dropped once auth has finished restoring (isAuthLoading
  // false): while it is still in flight `user` is legitimately null, and
  // discarding then would recreate the very bug this fixes.
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user || !isInterpreter()) {
      // Session resolved to something that cannot claim this invite; drop it so
      // it never replays into an unrelated login.
      void pendingInviteStorage.get().then((pending) => {
        if (pending) void pendingInviteStorage.clear();
      });
      return;
    }

    let cancelled = false;
    void pendingInviteStorage.get().then((pending) => {
      if (cancelled || !pending) return;

      const key = inviteKeyOf(pending.roomName, pending.inviteId);
      if (consumedInviteKeysRef.current.has(key)) {
        void pendingInviteStorage.clear();
        return;
      }
      consumedInviteKeysRef.current.add(key);

      // Clear before navigating: a failed claim must not leave the entry behind
      // to be replayed on the next launch.
      void pendingInviteStorage.clear();

      console.log('[useNotifications] Replaying cold-start interpreter invite:', {
        roomName: pending.roomName,
        inviteId: pending.inviteId,
        ageMs: Date.now() - pending.createdAt,
      });

      acceptInterpreterInviteFromTap(pending);
    });

    return () => {
      cancelled = true;
    };
  }, [user, isAuthLoading, isInterpreter, acceptInterpreterInviteFromTap]);

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
