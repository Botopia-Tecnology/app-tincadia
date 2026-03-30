import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Vibration, DeviceEventEmitter } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
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
    participants?: CallParticipant[] 
  } | null>(null);
  
  const [interpreterInvite, setInterpreterInvite] = useState<{ 
    roomName: string; 
    senderId: string; 
    senderName: string 
  } | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

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
              avatar: (m as any).profilePicture || (m as any).avatar || (m as any).avatarUrl
            }));
          }
        }
      }
    } catch (err) {
      console.error('Error resolving caller info:', err);
    }

    return { callerName, callerPhoto, participants };
  }, []);

  useEffect(() => {
    if (!user) return;

    const registerForPush = async () => {
      if (!Device.isDevice) return;

      if (Platform.OS === 'android') {
        await Notifications.deleteNotificationChannelAsync('default');
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
        
        if (token) {
          await authService.updatePushToken(user.id, token);
          console.log('✅ Push Token Registered:', token);
        }
      }
    };

    registerForPush();

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

        if (data?.type === 'call' && data?.conversationId && data?.senderId) {
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
          });
          // Dismiss so it doesn't re-trigger on next app open
          await Notifications.dismissNotificationAsync(
            lastResponse.notification.request.identifier
          ).catch(() => {});
        } else if (data?.type === 'call_invite' && data?.roomName && data?.senderId) {
          setInterpreterInvite({
            roomName: String(data.roomName),
            senderId: String(data.senderId),
            senderName: String(data.senderName || 'Usuario'),
          });
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
        });
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      } else if (data?.type === 'call_invite' && data?.roomName && data?.senderId) {
        setInterpreterInvite({
          roomName: String(data.roomName),
          senderId: String(data.senderId),
          senderName: String(data.senderName || 'Usuario')
        });
        Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
      } else {
        Vibration.vibrate();
      }

      if (data?.type === 'call_ended' || data?.type === 'call_rejected') {
        setIncomingCall(null);
        DeviceEventEmitter.emit('external_call_ended', { 
            conversationId: String(data?.conversationId || ''),
            roomName: String(data?.roomName || data?.conversationId || '')
        });
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // TAP LISTENER (Background → Foreground via notification tap)
    // User tapped the system notification while app was in background
    // (not killed). Show modal with full caller info.
    // ─────────────────────────────────────────────────────────────────────
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async response => {
      const data = response.notification.request.content.data;

      if (data?.type === 'call' && data?.conversationId && data?.senderId) {
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
        });
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

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [user, resolveCallerInfo]);

  return {
    incomingCall,
    setIncomingCall,
    interpreterInvite,
    setInterpreterInvite
  };
};
