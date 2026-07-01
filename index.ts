import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import RNVoipPushNotification from 'react-native-voip-push-notification';
import App from './src/app/App';
import { callKeepService } from './src/services/callkeep.service';
import { userStorage } from './src/lib/secure-storage';
import { CallState } from './src/lib/callState';

function isSameUserId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function getStringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value);
  return text.length > 0 ? text : undefined;
}

async function isOwnCallPayload(data: Record<string, string> | undefined): Promise<boolean> {
  if (!data?.senderId && !data?.sender_id) return false;

  try {
    const storedUser = await userStorage.getUser();
    if (!storedUser) return false;

    const user = JSON.parse(storedUser);
    return isSameUserId(data.senderId || data.sender_id, user?.id);
  } catch {
    return false;
  }
}

function endNativeCallFromPayload(data: Record<string, string> | undefined) {
  const idsToEnd = Array.from(new Set([
    data?.nativeCallUUID,
    data?.callUUID,
    data?.uuid,
    data?.conversationId,
    data?.roomName,
  ].filter(Boolean))) as string[];

  idsToEnd.forEach((id) => {
    try {
      callKeepService.dismissIncomingCall(id);
    } catch {
      // Native call UI may already be dismissed.
    }
  });
}

async function handleVoipPushNotification(notificationObj: unknown) {
  console.log('Background VoIP Push received:', notificationObj);
  const notification = (notificationObj && typeof notificationObj === 'object')
    ? notificationObj as Record<string, any>
    : {};

  if (notification?.type === 'call_ended' || notification?.type === 'call_missed' || notification?.type === 'call_rejected') {
    endNativeCallFromPayload(notification as Record<string, string>);
    return;
  }

  if (await isOwnCallPayload(notification as Record<string, string>)) return;

  const conversationId = getStringValue(notification.conversationId);
  const senderName = getStringValue(notification.senderName || notification.callerName);
  const callUUID = getStringValue(notification.nativeCallUUID || notification.callUUID || notification.uuid);
  const roomName = getStringValue(notification.roomName);
  const nativeCallId = callUUID || roomName || conversationId;

  if (nativeCallId) {
    // PushKit/AppDelegate reports the native CallKit UI on iOS.
    // Keep only the app-side context here to avoid displaying the same call twice.
    callKeepService.registerIncomingCallContext(nativeCallId, nativeCallId, {
      roomName,
      conversationId,
      callSessionId: getStringValue(notification.callSessionId || notification.call_session_id),
      senderId: getStringValue(notification.senderId || notification.sender_id),
      senderName,
    }, true);
  }
}

// Initialize CallKeep early in the lifecycle
callKeepService.setup();

// ---- ANDROID: Background FCM Handler ----
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background FCM received:', remoteMessage);
  const data = remoteMessage.data as Record<string, string> | undefined;
  if (data?.type === 'call') {
    if (await isOwnCallPayload(data)) return;

    // AVOID HUAWEI/EMUI QUEUED MESSAGE BUG:
    // If the message was delayed by the OS and is older than 30 seconds, ignore it.
    const now = Date.now();
    const sentTime = remoteMessage.sentTime || now;
    if (now - sentTime > 30000) {
      console.log('Background FCM call message is too old (delayed by OS), ignoring.');
      return;
    }

    if (CallState.isInsideCallScreen) {
      console.log('Ignoring Background FCM call because user is already inside CallScreen.');
      return;
    }

    const callUUID = data.callUUID || data.roomName || data.conversationId;
    if (callUUID) {
      callKeepService.displayIncomingCall(callUUID, 'Tincadia Llamada', data.senderName || 'Llamada entrante', {
        roomName: data.roomName,
        conversationId: data.conversationId,
        callSessionId: data.callSessionId,
        senderId: data.senderId || data.sender_id,
        senderName: data.senderName,
      });
    }
  } else if (data?.type === 'call_ended' || data?.type === 'call_missed' || data?.type === 'call_rejected') {
    endNativeCallFromPayload(data);
  }
});

// ---- iOS: VoIP Push Background Handler ----
RNVoipPushNotification.addEventListener('didLoadWithEvents', (events: any) => {
  if (!Array.isArray(events)) return;

  events.forEach((event) => {
    if (event?.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
      void handleVoipPushNotification(event.data);
    }
  });
});

RNVoipPushNotification.addEventListener('notification', handleVoipPushNotification);

// Register headless task for Android incoming calls via FCM Data
AppRegistry.registerHeadlessTask('RNCallKeepBackgroundMessage', () => ({ name, callUUID, handle }: any) => {
  return Promise.resolve();
});

registerRootComponent(App);
