/**
 * Main App Component
 * 
 * Wraps the app with AuthProvider and handles:
 * - Splash screen during initial load
 * - Login screen for unauthenticated users
 * - Profile completion for OAuth users with incomplete profiles
 * - Main app screens for fully authenticated users
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Text, View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import * as Notifications from 'expo-notifications';
import { I18nProvider } from '../contexts/I18nContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { chatService } from '../services/chat.service';
import { useSubscription } from '../hooks/useSubscription';
import { ScreenName, NavigationParams } from '../types/navigation.types';
import { SplashScreen } from '../components/SplashScreen';
import { LoginScreen } from '../components/LoginScreen';
import { CompleteProfileScreen } from '../components/CompleteProfileScreen';
import { ChatsScreen } from '../components/ChatsScreen';
import { NewGroupScreen } from '../components/NewGroupScreen';
import { CoursesScreen } from '../components/CoursesScreen';
import { CoursePlayerScreen } from '../components/CoursePlayerScreen';
import { CoursePresentationScreen } from '../components/CoursePresentationScreen';
import { SOSScreen } from '../components/SOSScreen';
import { ProfileScreen } from '../components/ProfileScreen';
import { NotificationsScreen } from '../components/NotificationsScreen';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { CallScreen } from '../screens/CallScreen';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { AlertProvider } from '../components/common/CustomAlert';
import { LSCPreloader } from '../components/LSCPreloader';
import { useNotifications } from '../hooks/useNotifications';
import { useDeepLinking } from '../hooks/useDeepLinking';
import { useAppInitialization } from '../hooks/useAppInitialization';
import { appStyles as styles } from '../styles/App.styles';

// Initialize Sentry with Session Replay
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  debug: __DEV__,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: __DEV__ ? 1.0 : 0.1,
  replaysOnErrorSampleRate: 1.0,
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
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isCall = data?.type === 'call' || data?.type === 'call_invite';
    // Always read AppState DYNAMICALLY inside the handler, never capture it outside.
    // When the app is in foreground the in-app modal handles call UI,
    // but we still need the system notification for when it's in background/killed.
    const isForeground = AppState.currentState === 'active';

    if (isCall) {
      return {
        // Show system notification only in background so it rings even when the
        // app is not visible. The foreground listener will show the in-app modal.
        shouldShowAlert: !isForeground,
        shouldPlaySound: !isForeground,
        shouldSetBadge: false,
        shouldShowBanner: !isForeground,
        shouldShowList: true,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});



function AppContent() {
  const { isAuthenticated, profileComplete, isLoading, user } = useAuth();
  const { colors } = useTheme();
  
  // Navigation stack
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['chats']);
  const [callParams, setCallParams] = useState<{ roomName?: string; username?: string; conversationId?: string; userId?: string } | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [initialChatParams, setInitialChatParams] = useState<{ conversationId?: string; recipientId?: string; isGroup?: boolean; title?: string } | null>(null);
  
  const { isPremium, isLoading: isSubscriptionLoading } = useSubscription(user?.id);

  const currentScreen = useMemo(() => screenStack[screenStack.length - 1] ?? 'chats', [screenStack]);

  const navigate = useCallback((next: ScreenName, params?: NavigationParams) => {
    if (next === 'call' && params) setCallParams(params as any);
    if ((next === 'course_player' || next === 'course_presentation') && params?.courseId) setSelectedCourseId(params.courseId);
    if (next === 'chats' && params?.conversationId) {
      setInitialChatParams({
        conversationId: params.conversationId,
        recipientId: params.recipientId,
        isGroup: params.isGroup,
        title: params.title
      });
    }
    setScreenStack((prev) => prev[prev.length - 1] === next ? prev : [...prev, next]);
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // Notifications logic
  const { incomingCall, setIncomingCall, interpreterInvite, setInterpreterInvite } = useNotifications(
    user,
    (params) => {
      setScreenStack(['chats']);
      setInitialChatParams(params);
    },
    (params) => {
      setCallParams(params);
      setScreenStack(prev => [...prev, 'call']);
    }
  );

  // Deep linking logic
  useDeepLinking(isAuthenticated, user, isPremium, isSubscriptionLoading, (params) => {
    setCallParams(params);
    setScreenStack(prev => prev[prev.length - 1] === 'call' ? prev : [...prev, 'call']);
  });

  // Call Handlers
  const handleAcceptCall = async () => {
    if (!incomingCall || !user) return;
    if (user.role === 'interpreter') await chatService.updateInterpreterStatus(user.id, true).catch(() => {});
    setCallParams({
      roomName: incomingCall.conversationId,
      username: user.firstName || user.email?.split('@')[0] || 'Usuario',
      conversationId: incomingCall.conversationId,
      userId: user.id
    });
    setIncomingCall(null);
    setScreenStack(prev => [...prev, 'call']);
  };

  const handleDeclineCall = async () => {
    if (incomingCall && user) await chatService.sendMessage({
      conversationId: incomingCall.conversationId,
      senderId: user.id,
      content: '📞 Llamada rechazada',
      type: 'call_ended'
    }).catch(() => {});
    setIncomingCall(null);
  };

  const handleAcceptInterpreterInvite = async () => {
    if (!interpreterInvite || !user) return;
    if (user.role === 'interpreter') await chatService.updateInterpreterStatus(user.id, true).catch(() => {});
    setCallParams({
      roomName: interpreterInvite.roomName,
      username: user.firstName || user.email?.split('@')[0] || 'Usuario',
      conversationId: interpreterInvite.roomName,
      userId: user.id
    });
    setInterpreterInvite(null);
    setScreenStack(prev => [...prev, 'call']);
  };

  // Android Hardware Back Handler
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAuthenticated && profileComplete) {
        if (currentScreen === 'call') {
          setScreenStack(prev => prev.length > 1 ? prev.slice(0, -1) : ['chats']);
          return true;
        }
        if (screenStack.length > 1) goBack();
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, [isAuthenticated, profileComplete, currentScreen, screenStack.length, goBack]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={[styles.loadingText, { color: colors.text }]}>Cargando...</Text>
      </View>
    );
  }

  if (!isAuthenticated) return <LoginScreen />;
  if (!profileComplete) return <CompleteProfileScreen />;

  const userId = user?.id || '';
  const isCallFullScreen = currentScreen === 'call';
  const underlyingScreen = isCallFullScreen ? (screenStack.length > 1 ? screenStack[screenStack.length - 2] : 'chats') : currentScreen;

  return (
    <>
      <IncomingCallModal
        visible={!!incomingCall}
        callerName={incomingCall?.callerName || 'Desconocido'}
        callerPhoto={incomingCall?.callerPhoto}
        participants={incomingCall?.participants}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
      />
      <IncomingCallModal
        visible={!!interpreterInvite}
        callerName={interpreterInvite?.senderName || 'Usuario'}
        subtitle="Solicita un intérprete en su llamada..."
        acceptText="Unirse"
        declineText="Ignorar"
        onAccept={handleAcceptInterpreterInvite}
        onDecline={() => setInterpreterInvite(null)}
      />
      <AnimatedScreen key={underlyingScreen}>
        {underlyingScreen === 'chats' ? (
          <ChatsScreen
            onNavigate={navigate}
            initialConversation={initialChatParams}
            onInitialConversationOpened={() => setInitialChatParams(null)}
          />
        ) : underlyingScreen === 'new_group' ? (
          <NewGroupScreen onNavigate={navigate} onBack={goBack} userId={userId} />
        ) : underlyingScreen === 'courses' ? (
          <CoursesScreen onNavigate={navigate} onBack={goBack} userId={userId} onShowNotifications={() => navigate('notifications')} />
        ) : underlyingScreen === 'course_player' && selectedCourseId ? (
          <CoursePlayerScreen courseId={selectedCourseId} onBack={goBack} />
        ) : underlyingScreen === 'course_presentation' && selectedCourseId ? (
          <CoursePresentationScreen courseId={selectedCourseId} onBack={goBack} onNavigate={navigate} userId={userId} />
        ) : underlyingScreen === 'sos' ? (
          <SOSScreen onNavigate={navigate} onBack={goBack} userId={userId} onShowNotifications={() => navigate('notifications')} />
        ) : underlyingScreen === 'notifications' ? (
          <NotificationsScreen userId={userId} onBack={goBack} />
        ) : (
          <ProfileScreen onNavigate={navigate} onBack={goBack} userId={userId} onShowNotifications={() => navigate('notifications')} />
        )}
      </AnimatedScreen>

      {callParams && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]} pointerEvents={isCallFullScreen ? "auto" : "box-none"}>
          <CallScreen
            roomName={callParams.roomName || 'default'}
            username={callParams.username || 'user'}
            conversationId={callParams.conversationId}
            userId={callParams.userId}
            isManualPipMode={!isCallFullScreen}
            onRestoreFromPip={() => currentScreen !== 'call' && setScreenStack(prev => [...prev, 'call'])}
            onMinimize={() => currentScreen === 'call' && goBack()}
            onBack={() => { setCallParams(null); currentScreen === 'call' && goBack(); }}
          />
        </View>
      )}
    </>
  );
}

function InnerApp() {
  const [isLoading, setIsLoading] = useState(true);
  useAppInitialization();

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  return (
    <I18nProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <AlertProvider>
            <LSCPreloader />
            <AppContent />
          </AlertProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

function App() {
  try {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PostHogProvider
          apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
          options={{
            host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
            disabled: true, // Desactivado por defecto hasta que se obtenga el permiso (ATT)
          }}
        >
          <SafeAreaProvider>
            <ThemeProvider>
              <InnerApp />
            </ThemeProvider>
          </SafeAreaProvider>
        </PostHogProvider>
      </GestureHandlerRootView>
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

export default Sentry.wrap(App);
