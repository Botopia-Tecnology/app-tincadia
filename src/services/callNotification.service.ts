import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidCategory,
  AndroidVisibility,
  EventType,
  Event,
} from '@notifee/react-native';
import RNCallKeep from 'react-native-callkeep';
import { pendingCallActionStorage } from '../lib/secure-storage';

export interface DisplayCallNotificationOptions {
  callUUID: string;
  callerName: string;
  avatarUrl?: string;
  roomName?: string;
  conversationId?: string;
  callSessionId?: string;
  senderId?: string;
  hasVideo?: boolean;
}

const INCOMING_CALLS_CHANNEL_ID = 'tincadia_incoming_calls';

class CallNotificationService {
  private channelCreated = false;
  private isListening = false;

  async setupChannel() {
    if (Platform.OS !== 'android' || this.channelCreated) return;

    try {
      await notifee.createChannel({
        id: INCOMING_CALLS_CHANNEL_ID,
        name: 'Llamadas Entrantes',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        sound: 'default',
        vibration: true,
        vibrationPattern: [0, 500, 250, 500],
        bypassDnd: true,
      });
      this.channelCreated = true;
    } catch (err) {
      console.warn('[CallNotificationService] Could not create incoming calls channel:', err);
    }
  }

  setupForegroundListeners() {
    if (Platform.OS !== 'android' || this.isListening) return;

    this.isListening = true;
    notifee.onForegroundEvent(async (event: Event) => {
      await this.handleNotificationEvent(event);
    });
  }

  async displayCallNotification(options: DisplayCallNotificationOptions) {
    if (Platform.OS !== 'android') return;

    await this.setupChannel();

    const {
      callUUID,
      callerName,
      avatarUrl,
      roomName,
      conversationId,
      callSessionId,
      senderId,
      hasVideo = false,
    } = options;

    console.log('[CallNotificationService] Displaying incoming call notification:', {
      callUUID,
      callerName,
      hasAvatar: Boolean(avatarUrl),
    });

    try {
      await notifee.displayNotification({
        id: callUUID,
        title: callerName || 'Llamada de Tincadia',
        body: hasVideo ? '📹 Videollamada entrante...' : '📞 Llamada de voz entrante...',
        data: {
          callUUID,
          callerName: callerName || '',
          roomName: roomName || '',
          conversationId: conversationId || '',
          callSessionId: callSessionId || '',
          senderId: senderId || '',
          hasVideo: hasVideo ? 'true' : 'false',
        },
        android: {
          channelId: INCOMING_CALLS_CHANNEL_ID,
          category: AndroidCategory.CALL,
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          smallIcon: 'phone_account_icon',
          color: '#0066FF',
          largeIcon: avatarUrl && avatarUrl.startsWith('http') ? avatarUrl : undefined,
          circularLargeIcon: true,
          autoCancel: false,
          ongoing: true,
          loopSound: true,
          sound: 'default',
          pressAction: {
            id: 'default',
            launchActivity: 'default',
          },
          fullScreenAction: {
            id: 'default',
            launchActivity: 'default',
          },
          actions: [
            {
              title: 'Rechazar',
              pressAction: {
                id: 'decline',
              },
            },
            {
              title: 'Contestar',
              pressAction: {
                id: 'answer',
                launchActivity: 'default',
              },
            },
          ],
        },
      });
    } catch (err) {
      console.error('[CallNotificationService] Failed to display notification:', err);
    }
  }

  async cancelCallNotification(callUUID: string) {
    if (Platform.OS !== 'android' || !callUUID) return;

    try {
      await notifee.cancelNotification(callUUID);
      console.log('[CallNotificationService] Cancelled notification for callUUID:', callUUID);
    } catch (err) {
      console.warn('[CallNotificationService] Could not cancel notification:', err);
    }
  }

  async handleNotificationEvent(event: Event) {
    const { type, detail } = event;
    const notification = detail.notification;
    const callUUID = notification?.id || (notification?.data?.callUUID as string | undefined);

    if (type === EventType.ACTION_PRESS || type === EventType.PRESS) {
      const actionId = detail.pressAction?.id;
      console.log('[CallNotificationService] User interacted with notification:', { type, actionId, callUUID });

      if (callUUID) {
        await this.cancelCallNotification(callUUID);
      }

      if ((actionId === 'answer' || type === EventType.PRESS || actionId === 'default') && callUUID) {
        const data = notification?.data || {};
        await pendingCallActionStorage.set({
          type: 'answer',
          callUUID,
          roomName: data.roomName as string,
          conversationId: data.conversationId as string,
          callSessionId: data.callSessionId as string,
          senderId: data.senderId as string,
          senderName: data.callerName as string,
          createdAt: Date.now(),
        }).catch((e) => console.warn('[CallNotificationService] Could not persist pending action:', e));

        try {
          RNCallKeep.answerIncomingCall(callUUID);
        } catch (e) {
          console.warn('[CallNotificationService] CallKeep answer error:', e);
        }
      } else if (actionId === 'decline' && callUUID) {
        try {
          RNCallKeep.rejectCall(callUUID);
        } catch (e) {
          console.warn('[CallNotificationService] CallKeep reject error:', e);
        }
      }
    } else if (type === EventType.DISMISSED && callUUID) {
      console.log('[CallNotificationService] Notification dismissed by user:', callUUID);
      try {
        RNCallKeep.rejectCall(callUUID);
      } catch (e) {
        console.warn('[CallNotificationService] CallKeep reject on dismiss error:', e);
      }
    }
  }
}

export const callNotificationService = new CallNotificationService();
