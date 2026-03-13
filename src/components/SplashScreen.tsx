import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { splashScreenStyles as styles } from '../styles/SplashScreen.styles';

interface SplashScreenProps {
  onFinish: () => void;
}

import { useTheme } from '../contexts/ThemeContext';

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { colors, isDark } = useTheme();

  // Simular tiempo de carga (puedes ajustar este tiempo)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000); // 2 segundos de pantalla de carga

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <View style={styles.logoContainer}>

      </View>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
    </View>
  );
}

