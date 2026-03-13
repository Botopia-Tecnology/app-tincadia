import { useState, useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
import { getLocalContacts, getConversation } from '../database/chatDatabase';

/**
 * Hook to handle all notification logic:
 * - Registration for push tokens
 * - Foreground notification listeners
 * - Notification response (tap) handlers
 * - Call and invite state management
 */
export const useNotifications = (user: any, onNavigateToChat: (params: any) => void, onNavigateToCall: (params: any) => void) => {
  const [incomingCall, setIncomingCall] = useState<{ 
    conversationId: string; 
    senderId: string; 
    callerName: string; 
    callerPhoto?: string; 
    participants?: any[] 
  } | null>(null);
  
  const [interpreterInvite, setInterpreterInvite] = useState<{ 
    roomName: string; 
    senderId: string; 
    senderName: string 
  } | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

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

    // Foreground Listener
    notificationListener.current = Notifications.addNotificationReceivedListener(async notification => {
      const data = notification.request.content.data;

      if (data?.type === 'call' && data?.conversationId && data?.senderId) {
        let callerName = String(data.senderName || notification.request.content.title || 'Usuario Tincadia');
        let callerPhoto: string | undefined;
        let participants: any[] = [];

        try {
          const localContacts = getLocalContacts(user.id);
          const contact = localContacts.find((c: any) => c.contact_user_id === String(data.senderId));
          if (contact) {
            callerName = contact.alias || `${contact.custom_first_name || ''} ${contact.custom_last_name || ''}`.trim() || contact.phone;
          }

          const conversation = getConversation(String(data.conversationId));
          if (conversation) {
            callerPhoto = conversation.other_user_avatar || conversation.image_url || undefined;
            if (conversation.type === 'group') {
              if (conversation.title) callerName = conversation.title;
              const members = await chatService.getGroupParticipants(String(data.conversationId));
              if (members && Array.isArray(members)) {
                participants = members.map((m: any) => ({
                  id: m.id,
                  name: `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Usuario',
                  avatar: m.profilePicture
                }));
              }
            }
          }
        } catch (err) {
          console.error('Error resolving caller info:', err);
        }

        setIncomingCall({
          conversationId: String(data.conversationId),
          senderId: String(data.senderId),
          callerName,
          callerPhoto,
          participants
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
      }
    });

    // Tap Listener
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      if (data?.type === 'call' && data?.conversationId && data?.senderId) {
        setIncomingCall({
          conversationId: String(data.conversationId),
          senderId: String(data.senderId),
          callerName: String(data.senderName || 'Usuario Tincadia'),
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
  }, [user]);

  return {
    incomingCall,
    setIncomingCall,
    interpreterInvite,
    setInterpreterInvite
  };
};
