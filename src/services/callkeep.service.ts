import { Platform } from 'react-native';
import RNCallKeep, { CONSTANTS } from 'react-native-callkeep';
import VoipPushNotification from 'react-native-voip-push-notification';
import { DeviceEventEmitter } from 'react-native';

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
  /** Temporarily true while we end/report the native UI ourselves, to suppress the endCall handler */
  private _suppressNextEndCall = false;
  private incomingCallTimeouts: Map<string, NodeJS.Timeout> = new Map();

  private clearIncomingCallTimeout(uuid: string) {
    const timeout = this.incomingCallTimeouts.get(uuid);
    if (timeout) {
      clearTimeout(timeout);
      this.incomingCallTimeouts.delete(uuid);
    }
  }

  private reportCallEndedSilently(uuid: string, reason: number) {
    this.clearIncomingCallTimeout(uuid);
    this._suppressNextEndCall = true;
    RNCallKeep.reportEndCallWithUUID(uuid, reason);
  }

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
    RNCallKeep.setCurrentCallActive(callUUID);
    this.clearIncomingCallTimeout(callUUID);

    if (Platform.OS === 'android') {
      RNCallKeep.backToForeground();
    }

    DeviceEventEmitter.emit('CallKeep_AnswerCall', { callUUID });
  };

  private handleEndCall = async ({ callUUID }: { callUUID: string }) => {
    if (this._suppressNextEndCall) {
      console.log('[CallKeep] ⏭️ Suppressing endCall (triggered by internal cleanup).');
      this._suppressNextEndCall = false;
      return;
    }

    console.log('[CallKeep] ❌ Ended call (native event triggered):', callUUID);
    DeviceEventEmitter.emit('CallKeep_EndCall', { callUUID });

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

      const realConvId = callUUID.startsWith('conv_') ? callUUID.replace('conv_', '') : callUUID;
      console.log('[CallKeep] Sending call_rejected for conversation:', realConvId);

      const { chatService } = require('./chat.service');
      await chatService.sendMessage({
        conversationId: realConvId,
        senderId: user.id,
        content: 'Llamada rechazada',
        type: 'call_rejected' as any
      });
      console.log('[CallKeep] ✅ Successfully notified backend of native rejection.');
    } catch (e) {
      console.log('[CallKeep] 🛑 Failed to report native rejection:', e);
    }
  };

  private handleDidDisplayIncomingCall = ({ error, callUUID, handle, localizedCallerName, hasVideo, fromPushKit, payload }: any) => {
    console.log('[CallKeep] didDisplayIncomingCall', callUUID, handle, localizedCallerName);
  };

  displayIncomingCall(uuid: string, handle: string, localizedCallerName: string) {
    RNCallKeep.displayIncomingCall(uuid, handle, localizedCallerName, 'generic', true);

    const timeout = setTimeout(() => {
      console.log(`[CallKeepService] Auto-hanging up incoming call ${uuid} due to 35s timeout.`);
      this.endCall(uuid);
    }, 35000);
    this.incomingCallTimeouts.set(uuid, timeout);
  }

  endCall(uuid: string) {
    this.clearIncomingCallTimeout(uuid);
    RNCallKeep.endCall(uuid);
  }

  endCallSilently(uuid: string) {
    this._suppressNextEndCall = true;
    this.clearIncomingCallTimeout(uuid);
    RNCallKeep.endCall(uuid);
  }

  dismissIncomingCall(uuid: string) {
    this.reportCallEndedSilently(uuid, CONSTANTS.END_CALL_REASONS.REMOTE_ENDED);
  }

  answerIncomingCallFromApp(uuid: string) {
    this.clearIncomingCallTimeout(uuid);
    RNCallKeep.answerIncomingCall(uuid);
    RNCallKeep.setCurrentCallActive(uuid);

    if (Platform.OS === 'android') {
      RNCallKeep.backToForeground();
    }
  }

  endAllCalls() {
    this.incomingCallTimeouts.forEach(clearTimeout);
    this.incomingCallTimeouts.clear();
    RNCallKeep.endAllCalls();
  }

  endAllCallsSilently() {
    this._suppressNextEndCall = true;
    this.incomingCallTimeouts.forEach(clearTimeout);
    this.incomingCallTimeouts.clear();
    RNCallKeep.endAllCalls();
  }

  setupVoipPush(onVoipToken: (token: string) => void) {
    if (Platform.OS !== 'ios') return;

    VoipPushNotification.registerVoipToken();

    VoipPushNotification.addEventListener('register', (token) => {
      console.log('[VoIP Push] Token received:', token);
      onVoipToken(token);
    });

    VoipPushNotification.addEventListener('notification', (notificationObj) => {
      console.log('[VoIP Push] Notification received:', notificationObj);

      const notification = notificationObj as any;
      const callUUID = notification.uuid || notification.callUUID;
      const callerName = notification.callerName || 'Tincadia';
      const handle = notification.handle || 'Tincadia Call';

      if (callUUID) {
        this.displayIncomingCall(callUUID, handle, callerName);
      }

      if (typeof VoipPushNotification.onVoipNotificationCompleted === 'function') {
        VoipPushNotification.onVoipNotificationCompleted(callUUID);
      }
    });
  }

  removeListeners() {
    RNCallKeep.removeEventListener('answerCall');
    RNCallKeep.removeEventListener('endCall');
    RNCallKeep.removeEventListener('didDisplayIncomingCall');

    if (Platform.OS === 'ios') {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
    }
  }
}

export const callKeepService = new CallKeepService();
