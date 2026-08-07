import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, Platform, Text, View, ActivityIndicator, StyleSheet, AppState, Alert, Keyboard } from 'react-native';
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
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { CompleteProfileScreen } from '../screens/CompleteProfileScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { NewGroupScreen } from '../screens/NewGroupScreen';
import { CoursesScreen } from '../screens/CoursesScreen';
import { CoursePlayerScreen } from '../screens/CoursePlayerScreen';
import { CoursePresentationScreen } from '../screens/CoursePresentationScreen';
import { CommunicationBoardScreen } from '../screens/CommunicationBoardScreen';
import { SOSScreen } from '../screens/SOSScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { AnimatedScreen } from '../components/AnimatedScreen';
import { QRScannerScreen } from '../screens/QRScannerScreen';
import { CallScreen } from '../screens/CallScreen';
import { IncomingCallModal } from '../components/IncomingCallModal';
import { AlertProvider } from '../components/common/CustomAlert';
import { LSCPreloader } from '../components/LSCPreloader';
import { ProductTourProvider } from '../contexts/ProductTourContext';
import { useNotifications } from '../hooks/useNotifications';
import { useDeepLinking } from '../hooks/useDeepLinking';
import { useAppInitialization } from '../hooks/useAppInitialization';
import { appStyles as styles } from '../styles/App.styles';

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

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const type = String((data as { type?: unknown }).type || '');
    const isCall = type === 'call';
    const isCallInvite = type === 'call_invite';
    const isSilentDismiss =
      type === 'call_invite_taken' ||
      String((data as { _action?: unknown })._action || '') === 'dismiss_invite';
    const isForeground = AppState.currentState === 'active';

    // Push silenciosos de cancelación de invitación: nunca mostrar banner.
    if (isSilentDismiss) {
      return {
        shouldShowAlert: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }

    // Solicitud de intérprete: SÍ debe llegar aunque la app esté abierta.
    if (isCallInvite) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }

    // Llamadas 1:1: en foreground lo cubre CallKit / UI nativa.
    if (isCall) {
      return {
        shouldShowAlert: !isForeground,
        shouldPlaySound: !isForeground,
        shouldSetBadge: false,
        shouldShowBanner: !isForeground,
        shouldShowList: true,
      };
    }

    // Mensajes y resto: no mostrar Expo notification si la app está en uso.
    return {
      shouldShowAlert: !isForeground,
      shouldPlaySound: !isForeground,
      shouldSetBadge: false,
      shouldShowBanner: !isForeground,
      shouldShowList: !isForeground,
    };
  },
});

function AppContent() {
  const { isAuthenticated, profileComplete, isLoading, user } = useAuth();
  const { colors } = useTheme();
  
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['chats']);
  const [callParams, setCallParams] = useState<{ roomName?: string; username?: string; conversationId?: string; userId?: string; callSessionId?: string; isIncomingCall?: boolean; nativeCallUUID?: string; suppressRinging?: boolean } | null>(null);
  const [profileParams, setProfileParams] = useState<{ openManagePlan?: boolean } | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [initialChatParams, setInitialChatParams] = useState<{ conversationId?: string; recipientId?: string; isGroup?: boolean; title?: string; description?: string } | null>(null);
  
  const { isPremium, isLoading: isSubscriptionLoading } = useSubscription(user?.id);

  const currentScreen = useMemo(() => screenStack[screenStack.length - 1] ?? 'chats', [screenStack]);

  const navigate = useCallback((next: any, params?: any) => {
    if (next === 'call') Keyboard.dismiss();
    if (next === 'call' && params) setCallParams(params as any);
    if (next === 'profile' && params) setProfileParams(params as any);
    if ((next === 'course_player' || next === 'course_presentation') && params?.courseId) setSelectedCourseId(params.courseId);
    if (next === 'chats' && params?.conversationId) {
      setInitialChatParams({
        conversationId: params.conversationId,
        recipientId: params.recipientId,
        isGroup: params.isGroup,
        title: params.title || params.groupTitle,
        description: params.description || params.groupDescription,
      });
    }
    setScreenStack((prev) => prev[prev.length - 1] === next ? prev : [...prev, next]);
  }, []);

  const returnToHome = useCallback(() => {
    setCallParams(null);
    setInitialChatParams(null);
    setScreenStack(['chats']);
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const { interpreterInvite, setInterpreterInvite, setActiveCall } = useNotifications(
    user,
    (params) => {
      setScreenStack(['chats']);
      setInitialChatParams(params);
    },
    (params) => {
      Keyboard.dismiss();
      setCallParams(params);
      setScreenStack(prev => prev[prev.length - 1] === 'call' ? prev : [...prev, 'call']);
    },
    returnToHome,
  );

  useEffect(() => {
    setActiveCall(callParams?.conversationId || null);
  }, [callParams, setActiveCall]);

  useDeepLinking(isAuthenticated, user, isPremium, isSubscriptionLoading, (params) => {
    Keyboard.dismiss();
    setCallParams(params);
    setScreenStack(prev => prev[prev.length - 1] === 'call' ? prev : [...prev, 'call']);
  });

  const handleAcceptInterpreterInvite = async () => {
    if (!interpreterInvite || !user) return;
    
    if (interpreterInvite.inviteId) {
      try {
        const claimResult = await chatService.claimInterpreterInvite(interpreterInvite.inviteId, user.id);
        if (!claimResult.success) {
          Alert.alert(
            'Llamada ocupada',
            claimResult.message || 'Esta llamada ya fue aceptada por otro compañero.',
            [{ text: 'Entendido', onPress: returnToHome }],
          );
          setInterpreterInvite(null);
          return;
        }
      } catch (err) {
        Alert.alert('Error', 'Hubo un problema al procesar la solicitud.');
        return;
      }
    } else if (user.role === 'interpreter') {
      await chatService.updateInterpreterStatus(user.id, true).catch(() => {});
    }

    Keyboard.dismiss();
    setCallParams({
      roomName: interpreterInvite.roomName,
      username: user.role === 'interpreter'
        ? `Intérprete: ${user.firstName || user.email?.split('@')[0] || 'Usuario'}`
        : (user.firstName || user.email?.split('@')[0] || 'Usuario'),
      conversationId: interpreterInvite.roomName,
      userId: user.id
    });
    setInterpreterInvite(null);
    setScreenStack(prev => prev[prev.length - 1] === 'call' ? prev : [...prev, 'call']);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAuthenticated && profileComplete) {
        if (currentScreen === 'call') {
          setScreenStack(prev => prev.length > 1 ? prev.slice(0, -1) : ['chats']);
          return true;
        }
        if (screenStack.length > 1) {
          goBack();
          return true;
        }
        return false; // Let default behavior (exit app) happen
      }
      return false; // Let default behavior happen
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
        ) : underlyingScreen === 'qr_scanner' ? (
          <QRScannerScreen onClose={goBack} onScan={async (data) => {
            if (data.includes('interpreter') || data.includes('INTERPRETE')) {
              if (!isPremium) {
                Alert.alert('Acceso Premium Requerido', 'Para conectar con un intérprete vía QR necesitas un plan activo.');
                goBack();
                return;
              }

              const userName = user?.firstName || user?.email || 'Usuario';
              const uId = user?.id || '';
              const rName = `qr-interpreter-${uId}-${Date.now()}`;

              try {
                Alert.alert(
                  'Solicitar Intérprete',
                  '¿Desea solicitar un intérprete para unirse a esta llamada?',
                  [
                    { text: 'Cancelar', style: 'cancel', onPress: () => goBack() },
                    {
                      text: 'Solicitar',
                      onPress: async () => {
                        try {
                          const result = await chatService.inviteInterpreters({
                            roomName: rName,
                            userId: uId,
                            username: userName,
                          });
                          if (result.success) {
                            Alert.alert('Solicitud enviada', `Se ha notificado a ${result.count || 1} intérprete(s).`);
                          } else {
                            Alert.alert('Info', result.message || 'No se pudo completar la solicitud.');
                          }
                          goBack();
                          navigate('call', { roomName: rName, username: userName, userId: uId });
                        } catch (error) {
                          Alert.alert('Error', 'No se pudo iniciar la llamada con el intérprete.');
                          goBack();
                        }
                      }
                    }
                  ]
                );
              } catch (error) {
                Alert.alert('Error', 'No se pudo iniciar la llamada con el intérprete.');
                goBack();
              }
            } else {
              Alert.alert('Código QR Detectado', `Contenido: ${data}`);
              goBack();
            }
          }} />
        ) : underlyingScreen === 'communication_board' ? (
          <CommunicationBoardScreen onBack={goBack} onNavigate={navigate} />
        ) : (
          <ProfileScreen 
            onNavigate={navigate} 
            onBack={goBack} 
            userId={userId} 
            onShowNotifications={() => navigate('notifications')} 
            openManagePlan={profileParams?.openManagePlan} 
          />
        )}
      </AnimatedScreen>

      {callParams && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 999, elevation: 999 }]} pointerEvents={isCallFullScreen ? "auto" : "box-none"}>
          <CallScreen
            roomName={callParams?.roomName || 'default'}
            username={callParams?.username || 'user'}
            conversationId={callParams?.conversationId}
            userId={callParams?.userId}
            callSessionId={callParams?.callSessionId}
            isIncomingCall={!!callParams?.isIncomingCall}
            suppressRinging={!!callParams?.suppressRinging}
            nativeCallUUID={callParams?.nativeCallUUID}
            isManualPipMode={!isCallFullScreen}
            onRestoreFromPip={() => currentScreen !== 'call' && setScreenStack(prev => prev[prev.length - 1] === 'call' ? prev : [...prev, 'call'])}
            onMinimize={() => currentScreen === 'call' && goBack()}
            onBack={() => { setCallParams(null); currentScreen === 'call' && goBack(); }}
            onCallRejected={returnToHome}
            onNavigate={navigate}
          />
        </View>
      )}

      <IncomingCallModal
        visible={!!interpreterInvite}
        callerName={interpreterInvite?.senderName || 'Usuario'}
        subtitle="Solicita un intérprete en su llamada..."
        acceptText="Unirse"
        declineText="Ignorar"
        onAccept={handleAcceptInterpreterInvite}
        onDecline={() => setInterpreterInvite(null)}
      />
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
          <ProductTourProvider>
            <AlertProvider>
              <LSCPreloader />
              <AppContent />
            </AlertProvider>
          </ProductTourProvider>
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
            disabled: true,
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
