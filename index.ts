import { registerRootComponent } from 'expo';
import './src/config/debug.config';
import { AppRegistry, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import App from './src/app/App';
import { callKeepService } from './src/services/callkeep.service';
import { CallState } from './src/lib/callState';
import { pendingInviteStorage } from './src/lib/secure-storage';

// Initialize CallKeep early in the lifecycle
callKeepService.setup();
// Register the PushKit listener before AuthContext/useNotifications. Native
// CallKit/PushKit delivery must not wait for a JavaScript session.
callKeepService.setupVoipPush();

// ---- ANDROID: Background FCM Handler ----
messaging().setBackgroundMessageHandler(async remoteMessage => {
  const data = remoteMessage.data as Record<string, string> | undefined;
  if (!data) return;

  const notificationType = data.type;
  if (notificationType !== 'call' &&
    notificationType !== 'call_ended' &&
    notificationType !== 'call_missed' &&
    notificationType !== 'call_rejected') {
    return;
  }

  if (notificationType === 'call') {
    // Avoid displaying calls that were queued by an OEM for too long. Terminal
    // notifications are still processed so stale native UI can be dismissed.
    const now = Date.now();
    const sentTime = remoteMessage.sentTime || now;
    if (sentTime > 0 && now - sentTime > 30000) return;

    if (CallState.isInsideCallScreen) return;
  }

  await callKeepService.ensureReady();
  await callKeepService.handleIncomingCallPayload(data);
});

// CallKeep also wakes JS for native actions before React mounts. Handle only
// validated data here; the actual incoming FCM call is handled above.
AppRegistry.registerHeadlessTask('RNCallKeepBackgroundMessage', () => async (taskData: unknown) => {
  await callKeepService.ensureReady();
  await callKeepService.handleBackgroundCallKeepMessage(taskData);
});

// ---- ANDROID: notification channels ----
// Created here rather than in useNotifications' registerForPush() because that
// runs only after a user session is restored. On a fresh install the very first
// interpreter invite can arrive before any login completes, and a push naming a
// channel that does not exist yet loses its high-importance/heads-up behaviour.
// Channel creation is idempotent, so registerForPush() re-running is harmless.
if (Platform.OS === 'android') {
  void Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  }).catch(() => { });

  void Notifications.setNotificationChannelAsync('incoming_calls', {
    name: 'Llamadas Entrantes',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500],
    lightColor: '#FF231F7C',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  }).catch(() => { });
}

// ---- COLD START: interpreter invite tapped while the app was killed ----
// addNotificationResponseReceivedListener only fires for taps that happen while
// it is mounted. When the tap itself launches the process, the response is
// already consumed by the time React (and the session) exist, so the interpreter
// lands on the home screen instead of the call. Persist it here — before the
// root component mounts — and let useNotifications replay it once `user` is
// known. Applies equally to iOS and Android: both deliver this tap via Expo.
void Notifications.getLastNotificationResponseAsync()
  .then((response) => {
    const data = response?.notification?.request?.content?.data as
      | Record<string, unknown>
      | undefined;
    if (!data || data.type !== 'call_invite' || !data.roomName) return;

    return pendingInviteStorage.set({
      type: 'call_invite',
      roomName: String(data.roomName),
      senderId: data.senderId != null ? String(data.senderId) : undefined,
      senderName: data.senderName != null ? String(data.senderName) : undefined,
      inviteId: data.inviteId != null ? String(data.inviteId) : undefined,
      createdAt: Date.now(),
    });
  })
  .catch((error) => {
    console.warn('[index] Could not read cold-start notification response:', error);
  });

registerRootComponent(App);
