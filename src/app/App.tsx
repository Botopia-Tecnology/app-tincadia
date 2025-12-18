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
import { BackHandler, Platform, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '../contexts/I18nContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { SplashScreen } from '../components/SplashScreen';
import { LoginScreen } from '../components/LoginScreen';
import { CompleteProfileScreen } from '../components/CompleteProfileScreen';
import { ChatsScreen } from '../components/ChatsScreen';
import { CoursesScreen } from '../components/CoursesScreen';
import { SOSScreen } from '../components/SOSScreen';
import { ProfileScreen } from '../components/ProfileScreen';
import { AnimatedScreen } from '../components/AnimatedScreen';

type ScreenName = 'chats' | 'courses' | 'sos' | 'profile';

function AppContent() {
  const { isAuthenticated, profileComplete, isLoading } = useAuth();

  // Simple navigation stack (no react-navigation). This lets Android "back" go to the previous screen.
  const [screenStack, setScreenStack] = useState<ScreenName[]>(['chats']);
  const currentScreen = useMemo(
    () => screenStack[screenStack.length - 1] ?? 'chats',
    [screenStack]
  );

  const navigate = useCallback((next: ScreenName) => {
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

  // Fully authenticated - show main app
  return (
    <AnimatedScreen key={currentScreen}>
      {currentScreen === 'chats' ? (
        <ChatsScreen onNavigate={navigate} />
      ) : currentScreen === 'courses' ? (
        <CoursesScreen onNavigate={navigate} onBack={goBack} />
      ) : currentScreen === 'sos' ? (
        <SOSScreen onNavigate={navigate} onBack={goBack} />
      ) : (
        <ProfileScreen onNavigate={navigate} onBack={goBack} />
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
      <SafeAreaProvider>
        <I18nProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </I18nProvider>
      </SafeAreaProvider>
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#CC0000',
    fontSize: 16,
    textAlign: 'center',
  },
});
