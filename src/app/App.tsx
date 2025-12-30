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
import { SplashScreen } from '../components/SplashScreen';
import { LoginScreen } from '../components/LoginScreen';
import { CompleteProfileScreen } from '../components/CompleteProfileScreen';
import { ChatsScreen } from '../components/ChatsScreen';
import { CoursesScreen } from '../components/CoursesScreen';
import { SOSScreen } from '../components/SOSScreen';
import { ProfileScreen } from '../components/ProfileScreen';
import { NotificationsScreen } from '../components/NotificationsScreen';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { CallScreen } from '../screens/CallScreen';
import { appStyles as styles } from '../styles/App.styles';

// Initialize Sentry with Session Replay
Sentry.init({
  dsn: 'https://[REDACTED]@o4510623853314048.ingest.us.sentry.io/4510623870615552',
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
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      // Alert.alert('Error', 'Permiso de notificaciones denegado. No podrás recibir alertas.');
      return;
    }

    try {
      // Get the token from Expo
      const expoPushTokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: '8bf6b071-622c-4428-a2f8-b83b95fa2d99',
      });
      token = expoPushTokenResponse.data;
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

type ScreenName = 'chats' | 'courses' | 'sos' | 'profile' | 'call' | 'notifications';

function AppContent() {
  const { isAuthenticated, profileComplete, isLoading, user } = useAuth();
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          authService.updatePushToken(user.id, token).catch(() => { });
        }
      });

      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('🔔 Notification Received in Foreground:', notification);
        setNotification(notification);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification Tapped:', response);
        // Here we could navigate to specific chat if data.conversationId exists
      });

      return () => {
        if (notificationListener.current) notificationListener.current.remove();
        if (responseListener.current) responseListener.current.remove();
      };
    }
  }, [isAuthenticated, user?.id]);

  // Simple navigation stack (no react-navigation). This lets Android "back" go to the previous screen.
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['chats']);
  const [callParams, setCallParams] = useState<{ roomName: string; username: string; conversationId?: string; userId?: string } | null>(null);
  const currentScreen = useMemo(
    () => screenStack[screenStack.length - 1] ?? 'chats',
    [screenStack]
  );

  const navigate = useCallback((next: ScreenName, params?: any) => {
    if (next === 'call' && params) {
      setCallParams(params);
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

  // Keep a ref so the BackHandler can be registered once and still see latest state.
  const backStateRef = useRef({
    isAuthenticated,
    profileComplete,
    stackLength: screenStack.length,
  });
  useEffect(() => {
    backStateRef.current = {
      isAuthenticated,
      profileComplete,
      stackLength: screenStack.length,
    };
  }, [isAuthenticated, profileComplete, screenStack.length]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we have something to go back to in the "main" app, do it.
      if (backStateRef.current.isAuthenticated && backStateRef.current.profileComplete) {
        if (backStateRef.current.stackLength > 1) {
          goBack();
        }
        // Always consume so it doesn't close/minimize the app.
        return true;
      }

      // For login / profile completion flows, also consume (so it doesn't exit the app).
      // Nested screens (e.g. register / forgot password) can register their own BackHandler
      // and will take priority over this one.
      return true;
    });

    return () => sub.remove();
  }, [goBack]);

  // Show loading while auth state is being determined
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Authenticated but profile incomplete - show profile completion
  if (!profileComplete) {
    return <CompleteProfileScreen />;
  }

  const userId = user?.id || '';

  // Handler to navigate to notifications screen
  const handleShowNotifications = () => {
    navigate('notifications');
  };

  // Fully authenticated - show main app
  return (
    <AnimatedScreen key={currentScreen}>
      {currentScreen === 'chats' ? (
        <ChatsScreen onNavigate={navigate} />
      ) : currentScreen === 'courses' ? (
        <CoursesScreen
          onNavigate={navigate}
          onBack={goBack}
          userId={userId}
          onShowNotifications={handleShowNotifications}
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
        apiKey="[REDACTED]"
        options={{
          host: 'https://us.i.posthog.com',
        }}
      >
        <SafeAreaProvider>
          <I18nProvider>
            <AuthProvider>
              <AppContent />
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
