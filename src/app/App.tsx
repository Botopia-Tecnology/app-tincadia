/**
 * Main App Component
 * 
 * Wraps the app with AuthProvider and handles:
 * - Splash screen during initial load
 * - Login screen for unauthenticated users
 * - Profile completion for OAuth users with incomplete profiles
 * - Main app screens for fully authenticated users
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, Text, View, ActivityIndicator, Alert, Button } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { I18nProvider } from '../contexts/I18nContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
import { SplashScreen } from '../components/SplashScreen';
import { LoginScreen } from '../components/LoginScreen';
import { CompleteProfileScreen } from '../components/CompleteProfileScreen';
import { ChatsScreen } from '../components/ChatsScreen';
import { NewGroupScreen } from '../components/NewGroupScreen';
import { CoursesScreen } from '../components/CoursesScreen';
import { CoursePlayerScreen } from '../components/CoursePlayerScreen';
import { SOSScreen } from '../components/SOSScreen';
import { ProfileScreen } from '../components/ProfileScreen';
import { NotificationsScreen } from '../components/NotificationsScreen';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { CallScreen } from '../screens/CallScreen';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { AlertProvider } from '../components/common/CustomAlert';
import { appStyles as styles } from '../styles/App.styles';

// Initialize Sentry with Session Replay
Sentry.init({
  dsn: 'https://922f74ca4e17c001f4ecd489c52e1055@o4510623853314048.ingest.us.sentry.io/4510623870615552',
  debug: __DEV__,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1, // 100% in dev, 10% in prod
  replaysOnErrorSampleRate: 1.0, // Always capture replay on error
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
      maskAllVectors: true,
    }),
  ],
});

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('incoming_calls', {
      name: 'Incoming Calls',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 1000, 1000, 1000, 1000, 1000, 1000], // Longer vibration loop
      sound: 'default', // Or custom if we had one
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      // Get the token from Expo
      const expoPushTokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: '8bf6b071-622c-4428-a2f8-b83b95fa2d99',
      });
      token = expoPushTokenResponse.data;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      // Alert.alert('Error', 'Permiso de notificaciones denegado. No podrás recibir alertas.');
      return;
    }

    try {
      console.log('✅ Expo Push Token:', token);
      // Alert.alert('Token Generado', token); // Optional: Uncomment to verify specific token
    } catch (e: any) {
      console.error('Error getting push token:', e);
      Alert.alert('Error Push Token', `No se pudo generar el token: ${e.message}`);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

type ScreenName = 'chats' | 'courses' | 'sos' | 'profile' | 'call' | 'notifications' | 'course_player' | 'new_group';

function AppContent() {
  const { isAuthenticated, profileComplete, isLoading, user } = useAuth();
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Simple navigation stack
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['chats']);
  const [callParams, setCallParams] = useState<{ roomName: string; username: string; conversationId?: string; userId?: string } | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [initialChatParams, setInitialChatParams] = useState<{ conversationId?: string; recipientId?: string; isGroup?: boolean; title?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ conversationId: string; senderId: string; callerName: string } | null>(null);

  // Keep ref for listeners
  const backStateRef = useRef({
    isAuthenticated,
    profileComplete,
    stackLength: screenStack.length,
    currentScreen: screenStack[screenStack.length - 1] ?? 'chats'
  });

  useEffect(() => {
    if (isAuthenticated && user) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          authService.updatePushToken(user.id, token).catch(() => { });
        }
      });

      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification Received in Foreground:', notification);
        const data = notification.request.content.data;

        // Detect incoming call
        if (data?.type === 'call' && data?.conversationId && data?.senderId) {
          setIncomingCall({
            conversationId: String(data.conversationId),
            senderId: String(data.senderId),
            callerName: String(data.senderName || notification.request.content.title || 'Usuario Tincadia')
          });
          Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => { });
        }

        // Detect call ended
        if (data?.type === 'call_ended' || data?.type === 'call_rejected') {
          setIncomingCall(null);
          // Use ref to check current screen to avoid stale closure
          if (backStateRef.current.currentScreen === 'call') {
            setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
          }
        }

        setNotification(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification Tapped:', response);
        const data = response.notification.request.content.data;

        if (data?.type === 'call' && data?.conversationId && data?.senderId) {
          // Tap on call notification -> go to call screen
          setIncomingCall(null);
          setCallParams({
            roomName: String(data.conversationId),
            username: user.email?.split('@')[0] || user.id,
            conversationId: String(data.conversationId),
            userId: user.id
          });
          setScreenStack(prev => [...prev, 'call']);
          return;
        }

        if (data?.conversationId && data?.senderId) {
          setScreenStack(['chats']);
          setInitialChatParams({
            conversationId: String(data.conversationId),
            recipientId: String(data.senderId)
          });
        }
      });

      return () => {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      };
    }
  }, [isAuthenticated, user?.id]);

  const handleAcceptCall = () => {
    if (!incomingCall || !user) return;

    setCallParams({
      roomName: incomingCall.conversationId,
      username: user.id, // Should match what CallScreen expects
      conversationId: incomingCall.conversationId,
      userId: user.id
    });
    setIncomingCall(null);
    setScreenStack(prev => [...prev, 'call']);
  };

  const handleDeclineCall = async () => {
    if (incomingCall && user) {
      try {
        await chatService.sendMessage({
          conversationId: incomingCall.conversationId,
          senderId: user.id,
          content: '📞 Llamada rechazada',
          type: 'call_ended'
        });
      } catch (error) {
        console.error('Error declining call:', error);
      }
    }
    setIncomingCall(null);
  };

  const currentScreen = useMemo(
    () => screenStack[screenStack.length - 1] ?? 'chats',
    [screenStack]
  );

  const navigate = useCallback((next: ScreenName, params?: any) => {
    if (next === 'call' && params) {
      setCallParams(params);
    }
    if (next === 'course_player' && params?.courseId) {
      setSelectedCourseId(params.courseId);
    }
    if (next === 'chats' && params?.conversationId) {
      setInitialChatParams({
        conversationId: params.conversationId,
        recipientId: params.recipientId,
        isGroup: params.isGroup,
        title: params.title
      });
    }
    setScreenStack((prev) => {
      const last = prev[prev.length - 1];
      if (last === next) return prev;
      return [...prev, next];
    });
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);



  useEffect(() => {
    backStateRef.current = {
      isAuthenticated,
      profileComplete,
      stackLength: screenStack.length,
      currentScreen: screenStack[screenStack.length - 1] ?? 'chats'
    };
  }, [isAuthenticated, profileComplete, screenStack]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (backStateRef.current.isAuthenticated && backStateRef.current.profileComplete) {
        if (backStateRef.current.stackLength > 1) {
          goBack();
        }
        return true;
      }
      return true;
    });

    return () => sub.remove();
  }, [goBack]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;
  if (!profileComplete) return <CompleteProfileScreen />;

  const userId = user?.id || '';
  const handleShowNotifications = () => navigate('notifications');

  return (
    <>
      <IncomingCallModal
        visible={!!incomingCall}
        callerName={incomingCall?.callerName || 'Desconocido'}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
      <AnimatedScreen key={currentScreen}>
        {currentScreen === 'chats' ? (
          <ChatsScreen
            onNavigate={navigate}
            initialConversation={initialChatParams}
            onInitialConversationOpened={() => setInitialChatParams(null)}
          />
        ) : currentScreen === 'new_group' ? (
          <NewGroupScreen
            onNavigate={navigate}
            onBack={goBack}
            userId={userId}
          />
        ) : currentScreen === 'courses' ? (
          <CoursesScreen
            onNavigate={navigate}
            onBack={goBack}
            userId={userId}
            onShowNotifications={handleShowNotifications}
            onCourseSelect={(courseId) => navigate('course_player', { courseId })}
          />
        ) : currentScreen === 'course_player' && selectedCourseId ? (
          <CoursePlayerScreen
            courseId={selectedCourseId}
            onBack={goBack}
          />
        ) : currentScreen === 'sos' ? (
          <SOSScreen
            onNavigate={navigate}
            onBack={goBack}
            userId={userId}
            onShowNotifications={handleShowNotifications}
          />
        ) : currentScreen === 'notifications' ? (
          <NotificationsScreen
            userId={userId}
            onBack={goBack}
          />
        ) : currentScreen === 'call' ? (
          <CallScreen
            roomName={callParams?.roomName || 'default'}
            username={callParams?.username || 'user'}
            conversationId={callParams?.conversationId}
            userId={callParams?.userId}
            onBack={goBack}
          />
        ) : (
          <ProfileScreen
            onNavigate={navigate}
            onBack={goBack}
            userId={userId}
            onShowNotifications={handleShowNotifications}
          />
        )}
      </AnimatedScreen>
    </>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  try {
    return (
      <PostHogProvider
        apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
        options={{
          host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
        }}
      >
        <SafeAreaProvider>
          <I18nProvider>
            <AuthProvider>
              <AlertProvider>
                <AppContent />
              </AlertProvider>
            </AuthProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </PostHogProvider>
    );
  } catch (error) {
    console.error('Error en App:', error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {String(error)}</Text>
      </View>
    );
  }
}
