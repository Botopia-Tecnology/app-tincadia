/**
 * Main App Component
 * 
 * Wraps the app with AuthProvider and handles:
 * - Splash screen during initial load
 * - Login screen for unauthenticated users
 * - Profile completion for OAuth users with incomplete profiles
 * - Main app screens for fully authenticated users
 */

import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('chats');

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
        <ChatsScreen onNavigate={setCurrentScreen} />
      ) : currentScreen === 'courses' ? (
        <CoursesScreen onNavigate={setCurrentScreen} />
      ) : currentScreen === 'sos' ? (
        <SOSScreen onNavigate={setCurrentScreen} />
      ) : (
        <ProfileScreen onNavigate={setCurrentScreen} />
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
