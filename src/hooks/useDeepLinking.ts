import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { chatService } from '../services/chat.service';
import { User } from '../types/auth.types';
import { NavigationParams } from '../types/navigation.types';

/**
 * Hook to handle deep linking:
 * - Listens for URL changes
 * - Parses paths (e.g., /interpreter)
 * - Executes redirection logic / actions
 */
export const useDeepLinking = (
  isAuthenticated: boolean,
  user: User | null,
  isPremium: boolean,
  isSubscriptionLoading: boolean,
  onJoinCall: (params: NavigationParams) => void
) => {
  const [isProcessingLink, setIsProcessingLink] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) setPendingUrl(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) setPendingUrl(url);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingUrl || !isAuthenticated || !user || isSubscriptionLoading || isProcessingLink) return;

    const processUrl = async () => {
      const urlToProcess = pendingUrl;
      setPendingUrl(null);
      setIsProcessingLink(true);

      try {
        const parsedUrl = Linking.parse(urlToProcess);

        // Handle path: /interpreter
        if (parsedUrl.path === 'interpreter' || urlToProcess.includes('tincadia://interpreter')) {
          if (!isPremium) {
            Alert.alert('Acceso Denegado', 'Necesitas una suscripción premium para llamar a un intérprete.');
            return;
          }

          const username = user.firstName || user.email || 'Usuario';
          const roomName = `sos-${user.id}-${Date.now()}`;

          try {
            const result = await chatService.inviteInterpreters({
              roomName,
              userId: user.id,
              username,
            });

            if (result?.success) {
              Alert.alert('Solicitud enviada', `Se notificó a ${result.count || 1} intérprete(s).`);
            } else if (result?.message) {
              Alert.alert('Aviso', result.message);
            }

            onJoinCall({ roomName, username, userId: user.id });
          } catch (error) {
            console.error('Error solicitando intérprete QR:', error);
            Alert.alert('Error', 'No pudimos contactar a un intérprete. Intenta de nuevo.');
          }
        }
      } catch (e) {
        console.log('Error parsing deep link', e);
      } finally {
        setIsProcessingLink(false);
      }
    };

    processUrl();
  }, [pendingUrl, isAuthenticated, user, isSubscriptionLoading, isPremium, isProcessingLink]);
};
