import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { I18nProvider } from '../contexts/I18nContext';
import { SplashScreen } from '../components/SplashScreen';
import { LoginScreen } from '../components/LoginScreen';
import { ChatsScreen } from '../components/ChatsScreen';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (isLoading) {
    return <SplashScreen onFinish={() => setIsLoading(false)} />;
  }

  try {
    return (
      
      <I18nProvider>
        {isAuthenticated ? (
          <ChatsScreen />
        ) : (
          <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
        )}
      </I18nProvider>
    );
  } catch (error) {
    console.error('Error en App:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error: {String(error)}</Text>
      </View>
    );
  }
}
