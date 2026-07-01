import { Platform } from 'react-native';
import RNCallKeep, { CONSTANTS } from 'react-native-callkeep';
import VoipPushNotification from 'react-native-voip-push-notification';
import { DeviceEventEmitter } from 'react-native';
import { CallState } from '../lib/callState';

type NativeCallContext = {
  roomName?: string;
  conversationId?: string;
  callSessionId?: string;
  senderId?: string;
  senderName?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createUuid(): string {
  const randomUUID = ((globalThis as any).crypto as { randomUUID?: () => string } | undefined)?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function normalizeCallKey(value: string): string {
  return value.toLowerCase();
}

function getStringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > 0 ? text : undefined;
}

function asPayloadObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

const options = {
  ios: {
    appName: 'Tincadia',
    includesCallsInRecents: true,
  },
  android: {
    alertTitle: 'Permisos requeridos',
    alertDescription: 'Tincadia necesita tu permiso para manejar llamadas entrantes.',
    cancelButton: 'Cancelar',
    okButton: 'Aceptar',
    imageName: 'phone_account_icon',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'tincadia_calls',
      channelName: 'Llamadas Tincadia',
      notificationTitle: 'Tincadia está en una llamada',
      notificationIcon: 'ic_launcher'
    }
  }
};

class CallKeepService {
  private initialized = false;
  private voipPushInitialized = false;
  private voipTokenHandler?: (token: string) => void;
  /** Native UUIDs ended by app cleanup; only matching endCall events are suppressed. */
  private suppressedEndCallUUIDs: Set<string> = new Set();
  private suppressedEndCallTimers: Map<string, NodeJS.Timeout> = new Map();
  private incomingCallTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private nativeCallContexts: Map<string, NativeCallContext> = new Map();
  private nativeCallAliases: Map<string, string> = new Map();
  private displayedNativeCallUUIDs: Set<string> = new Set();

  resolveCallUUID(uuid: string) {
    return this.nativeCallAliases.get(normalizeCallKey(uuid)) || uuid;
  }

  registerIncomingCallContext(nativeUUID: string, requestedUUID: string, context: NativeCallContext = {}, nativeDisplayed = false) {
    this.rememberNativeCall(nativeUUID, requestedUUID, context);
    if (nativeDisplayed) {
      this.displayedNativeCallUUIDs.add(nativeUUID);
      CallState.setIncomingCallActive(context.conversationId, nativeUUID);
    }
  }

  private canUseNativeUUID(uuid: string, operation: string) {
    if (Platform.OS !== 'ios' || UUID_REGEX.test(uuid)) return true;
    console.warn(`[CallKeep] Skipping ${operation}: iOS CallKit requires a valid UUID, got:`, uuid);
    return false;
  }

  private getNativeUUIDKey(uuid: string) {
    return normalizeCallKey(this.resolveCallUUID(uuid));
  }

  private suppressEndCallOnce(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const key = normalizeCallKey(nativeUUID);
    this.suppressedEndCallUUIDs.add(key);

    const previousTimer = this.suppressedEndCallTimers.get(key);
    if (previousTimer) clearTimeout(previousTimer);

    const timer = setTimeout(() => {
      this.suppressedEndCallUUIDs.delete(key);
      this.suppressedEndCallTimers.delete(key);
    }, 8000);

    this.suppressedEndCallTimers.set(key, timer);
  }

  private consumeSuppressedEndCall(uuid: string) {
    const key = this.getNativeUUIDKey(uuid);
    if (!this.suppressedEndCallUUIDs.has(key)) return false;

    this.suppressedEndCallUUIDs.delete(key);
    const timer = this.suppressedEndCallTimers.get(key);
    if (timer) clearTimeout(timer);
    this.suppressedEndCallTimers.delete(key);
    return true;
  }

  private clearIncomingCallTimeout(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const timeout = this.incomingCallTimeouts.get(nativeUUID);
    if (timeout) {
      clearTimeout(timeout);
      this.incomingCallTimeouts.delete(nativeUUID);
    }
  }

  private forgetNativeCall(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const nativeKey = normalizeCallKey(nativeUUID);
    const context = this.nativeCallContexts.get(nativeKey);

    this.clearIncomingCallTimeout(nativeUUID);
    this.displayedNativeCallUUIDs.delete(nativeUUID);
    this.nativeCallContexts.delete(nativeKey);

    for (const [alias, mappedNativeUUID] of Array.from(this.nativeCallAliases.entries())) {
      if (normalizeCallKey(mappedNativeUUID) === nativeKey || alias === nativeKey) {
        this.nativeCallAliases.delete(alias);
      }
    }

    CallState.clearIncomingCall(context?.conversationId || nativeUUID);
  }

  private clearNativeCallMemory() {
    this.incomingCallTimeouts.forEach(clearTimeout);
    this.incomingCallTimeouts.clear();
    this.nativeCallAliases.clear();
    this.nativeCallContexts.clear();
    this.displayedNativeCallUUIDs.clear();
    CallState.clearAllIncomingCalls();
  }

  private reportCallEndedSilently(uuid: string, reason: number) {
    const nativeUUID = this.resolveCallUUID(uuid);
    if (!this.canUseNativeUUID(nativeUUID, 'reportEndCallWithUUID')) return;
    this.clearIncomingCallTimeout(nativeUUID);
    this.suppressEndCallOnce(nativeUUID);
    RNCallKeep.reportEndCallWithUUID(nativeUUID, reason);
    this.forgetNativeCall(nativeUUID);
  }

  private rememberNativeCall(nativeUUID: string, requestedUUID: string, context: NativeCallContext = {}) {
    const fullContext = {
      roomName: context.roomName || requestedUUID,
      conversationId: context.conversationId,
      callSessionId: context.callSessionId,
      senderId: context.senderId,
      senderName: context.senderName,
    };

    this.nativeCallContexts.set(normalizeCallKey(nativeUUID), fullContext);
    [nativeUUID, requestedUUID, fullContext.roomName, fullContext.conversationId]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .forEach((alias) => this.nativeCallAliases.set(normalizeCallKey(alias), nativeUUID));
  }

  private getNativeCallContext(uuid: string): NativeCallContext | undefined {
    const nativeUUID = this.resolveCallUUID(uuid);
    return this.nativeCallContexts.get(normalizeCallKey(nativeUUID));
  }

  private buildContextFromPayload(payload: unknown): NativeCallContext {
    const data = asPayloadObject(payload);
    return {
      roomName: getStringValue(data.roomName),
      conversationId: getStringValue(data.conversationId),
      callSessionId: getStringValue(data.callSessionId || data.call_session_id),
      senderId: getStringValue(data.senderId || data.sender_id),
      senderName: getStringValue(data.senderName || data.callerName || data.handle),
    };
  }

  private getRequestedUUIDFromPayload(payload: unknown, fallbackUUID?: string): string | undefined {
    const data = asPayloadObject(payload);
    return getStringValue(
      data.nativeCallUUID ||
      data.callUUID ||
      data.uuid ||
      data.roomName ||
      data.conversationId ||
      fallbackUUID
    );
  }

  private rememberDisplayedCallFromPayload(nativeUUID: string, payload: unknown, fallbackContext: NativeCallContext = {}) {
    const requestedUUID = this.getRequestedUUIDFromPayload(payload, nativeUUID) || nativeUUID;
    const payloadContext = this.buildContextFromPayload(payload);
    const context: NativeCallContext = {
      ...fallbackContext,
      ...payloadContext,
    };
    this.registerIncomingCallContext(nativeUUID, requestedUUID, context, true);
  }

  private handleVoipNotificationPayload = (notificationObj: unknown) => {
    console.log('[VoIP Push] Notification received:', notificationObj);

    const notification = asPayloadObject(notificationObj);
    const notificationType = getStringValue(notification.type);
    const callUUID = this.getRequestedUUIDFromPayload(notification);
    const callerName = getStringValue(notification.callerName || notification.senderName) || 'Tincadia';
    const handle = getStringValue(notification.handle || notification.senderName) || 'Tincadia Call';
    const completionUUID = getStringValue(notification.nativeCallUUID || notification.callUUID || notification.uuid || callUUID);

    if (notificationType === 'call_ended' || notificationType === 'call_missed' || notificationType === 'call_rejected') {
      if (callUUID) {
        try {
          this.dismissIncomingCall(callUUID);
        } catch (error) {
          console.warn('[VoIP Push] Could not dismiss terminal call notification:', error);
        }
      }
      if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(completionUUID);
      }
      return;
    }

    if (callUUID) {
      // PushKit should report CallKit natively in AppDelegate with fromPushKit:YES.
      // Here we only save the UUID <-> LiveKit room context so answer/end events
      // can navigate to the correct app room without displaying a duplicate call.
      this.registerIncomingCallContext(this.resolveCallUUID(callUUID), callUUID, {
        ...this.buildContextFromPayload(notification),
        senderName: getStringValue(notification.senderName) || callerName || handle,
      }, true);
    }

    if (completionUUID && typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
      VoipPushNotification.onVoipNotificationCompleted(completionUUID);
    }
  };

  setup() {
    if (this.initialized) return;

    try {
      RNCallKeep.setup(options).then(accepted => {
        console.log('[CallKeep] Setup accepted:', accepted);
        if (Platform.OS === 'android') {
          RNCallKeep.setAvailable(true);
        }
      });

      RNCallKeep.addEventListener('answerCall', this.handleAnswerCall);
      RNCallKeep.addEventListener('endCall', this.handleEndCall);
      RNCallKeep.addEventListener('didDisplayIncomingCall', this.handleDidDisplayIncomingCall);

      this.initialized = true;
      console.log('[CallKeep] Service initialized successfully.');
    } catch (error) {
      console.error('[CallKeep] Failed to initialize:', error);
    }
  }

  private handleAnswerCall = ({ callUUID }: { callUUID: string }) => {
    console.log('[CallKeep] ✅ Answered call:', callUUID);
    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(callUUID);
    }
    this.clearIncomingCallTimeout(callUUID);
    const context = this.getNativeCallContext(callUUID);
    CallState.clearIncomingCall(context?.conversationId || callUUID);

    if (Platform.OS === 'android') {
      RNCallKeep.backToForeground();
    }

    DeviceEventEmitter.emit('CallKeep_AnswerCall', { callUUID, ...context });
  };

  private handleEndCall = async ({ callUUID }: { callUUID: string }) => {
    if (this.consumeSuppressedEndCall(callUUID)) {
      console.log('[CallKeep] Suppressing endCall for UUID ended by internal cleanup:', callUUID);
      this.forgetNativeCall(callUUID);
      return;
    }

    console.log('[CallKeep] ❌ Ended call (native event triggered):', callUUID);
    const context = this.getNativeCallContext(callUUID);
    const wasInsideCallScreen = CallState.isInsideCallScreen;
    CallState.clearIncomingCall(context?.conversationId || callUUID);
    this.displayedNativeCallUUIDs.delete(this.resolveCallUUID(callUUID));
    DeviceEventEmitter.emit('CallKeep_EndCall', {
      callUUID,
      ...context,
      wasInsideCallScreen,
    });

    if (wasInsideCallScreen) {
      console.log('[CallKeep] Native end belongs to an active CallScreen; CallScreen will persist call_ended.');
      this.forgetNativeCall(callUUID);
      return;
    }

    try {
      console.log('[CallKeep] Attempting to read user from MMKV...');
      const { userStorage } = require('../lib/secure-storage');
      const userStr = await userStorage.getUser();

      if (!userStr) {
        console.warn('[CallKeep] ⚠️ userStr is empty! Cannot send call_rejected to backend.');
        return;
      }

      const user = JSON.parse(userStr);
      console.log('[CallKeep] User found in MMKV:', user.id);

      const realConvId = context?.conversationId || (callUUID.startsWith('conv_') ? callUUID.replace('conv_', '') : callUUID);
      console.log('[CallKeep] Sending call_rejected for conversation:', realConvId);

      const { chatService } = require('./chat.service');
      await chatService.sendMessage({
        conversationId: realConvId,
        senderId: user.id,
        content: 'Llamada rechazada',
        type: 'call_rejected' as any,
        metadata: context ? {
          roomName: context.roomName,
          callSessionId: context.callSessionId,
        } : undefined,
      });
      console.log('[CallKeep] ✅ Successfully notified backend of native rejection.');
    } catch (e) {
      console.log('[CallKeep] 🛑 Failed to report native rejection:', e);
    } finally {
      this.forgetNativeCall(callUUID);
    }
  };

  private handleDidDisplayIncomingCall = ({ error, callUUID, handle, localizedCallerName, payload }: any) => {
    console.log('[CallKeep] didDisplayIncomingCall', callUUID, handle, localizedCallerName, error, payload);
    if (error || !callUUID) return;

    this.rememberDisplayedCallFromPayload(callUUID, payload, {
      senderName: getStringValue(localizedCallerName || handle),
    });
  };

  displayIncomingCall(uuid: string, handle: string, localizedCallerName: string, context: NativeCallContext = {}) {
    const resolvedUUID = this.resolveCallUUID(uuid);
    const nativeUUID = Platform.OS === 'ios' && !UUID_REGEX.test(resolvedUUID) ? createUuid() : resolvedUUID;
    this.rememberNativeCall(nativeUUID, uuid, context);
    if (!this.canUseNativeUUID(nativeUUID, 'displayIncomingCall')) return nativeUUID;

    if (this.displayedNativeCallUUIDs.has(nativeUUID)) {
      console.log('[CallKeep] Ignoring duplicate displayIncomingCall for native UUID:', nativeUUID);
      return nativeUUID;
    }

    RNCallKeep.displayIncomingCall(nativeUUID, handle, localizedCallerName, 'generic', true);
    this.displayedNativeCallUUIDs.add(nativeUUID);
    CallState.setIncomingCallActive(context.conversationId, nativeUUID);

    const timeout = setTimeout(() => {
      console.log(`[CallKeepService] Auto-hanging up incoming call ${nativeUUID} due to 35s timeout.`);
      this.endCall(nativeUUID);
    }, 35000);
    this.incomingCallTimeouts.set(nativeUUID, timeout);
    return nativeUUID;
  }

  endCall(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const context = this.getNativeCallContext(nativeUUID);
    if (!this.canUseNativeUUID(nativeUUID, 'endCall')) return;
    this.clearIncomingCallTimeout(nativeUUID);
    RNCallKeep.endCall(nativeUUID);
    this.displayedNativeCallUUIDs.delete(nativeUUID);
    CallState.clearIncomingCall(context?.conversationId || nativeUUID);
  }

  endCallSilently(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    if (!this.canUseNativeUUID(nativeUUID, 'endCallSilently')) return;
    this.suppressEndCallOnce(nativeUUID);
    this.clearIncomingCallTimeout(nativeUUID);
    RNCallKeep.endCall(nativeUUID);
    this.forgetNativeCall(nativeUUID);
  }

  dismissIncomingCall(uuid: string) {
    this.reportCallEndedSilently(uuid, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
  }

  answerIncomingCallFromApp(uuid: string) {
    const nativeUUID = this.resolveCallUUID(uuid);
    const context = this.getNativeCallContext(nativeUUID);
    if (!this.canUseNativeUUID(nativeUUID, 'answerIncomingCall')) return;
    this.clearIncomingCallTimeout(nativeUUID);
    RNCallKeep.answerIncomingCall(nativeUUID);
    CallState.clearIncomingCall(context?.conversationId || nativeUUID);

    if (Platform.OS === 'android') {
      RNCallKeep.setCurrentCallActive(nativeUUID);
      RNCallKeep.backToForeground();
    }
  }

  endAllCalls() {
    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.warn('[CallKeep] Failed to end all calls:', error);
    } finally {
      this.clearNativeCallMemory();
    }
  }

  endAllCallsSilently() {
    const nativeUUIDs = Array.from(this.displayedNativeCallUUIDs);
    nativeUUIDs.forEach((nativeUUID) => this.suppressEndCallOnce(nativeUUID));

    try {
      RNCallKeep.endAllCalls();
    } catch (error) {
      console.warn('[CallKeep] Failed to silently end all calls:', error);
    } finally {
      this.clearNativeCallMemory();
    }
  }

  setupVoipPush(onVoipToken: (token: string) => void) {
    if (Platform.OS !== 'ios') return;
    this.voipTokenHandler = onVoipToken;

    if (this.voipPushInitialized) {
      VoipPushNotification.registerVoipToken();
      return;
    }
    this.voipPushInitialized = true;

    VoipPushNotification.addEventListener('didLoadWithEvents', (events: any) => {
      if (!Array.isArray(events)) return;

      events.forEach((event) => {
        if (event?.name === 'RNVoipPushRemoteNotificationsRegisteredEvent') {
          const token = getStringValue(event.data);
          if (token) {
            console.log('[VoIP Push] Cached token received:', token);
            this.voipTokenHandler?.(token);
          }
        }

        if (event?.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
          this.handleVoipNotificationPayload(event.data);
        }
      });
    });

    VoipPushNotification.addEventListener('register', (token) => {
      console.log('[VoIP Push] Token received:', token);
      this.voipTokenHandler?.(token);
    });

    VoipPushNotification.addEventListener('notification', this.handleVoipNotificationPayload);

    VoipPushNotification.registerVoipToken();
  }

  removeListeners() {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didDisplayIncomingCall');

    if (Platform.OS === 'ios') {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
      VoipPushNotification.removeEventListener('didLoadWithEvents');
    }
  }
}

export const callKeepService = new CallKeepService();
