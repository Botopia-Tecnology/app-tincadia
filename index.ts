import { registerRootComponent } from 'expo';
import './src/config/debug.config';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './src/app/App';
import { callKeepService } from './src/services/callkeep.service';
import { CallState } from './src/lib/callState';

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

registerRootComponent(App);
