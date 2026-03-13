import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as Clarity from '@microsoft/react-native-clarity';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { Audio } from 'expo-av';

/**
 * Hook to handle global app initializations:
 * - Sentry
 * - Clarity (Analytics)
 * - Audio Mode
 * - Tracking Transparency (iOS)
 */
export const useAppInitialization = () => {
  useEffect(() => {
    // Sentry Initialization is done globally at the top of App.tsx
    // but we can put other initializations here.
    
    const initTracking = async () => {
      let canTrack = false;
      if (Platform.OS === 'ios') {
        const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
        canTrack = status === 'granted';
      } else {
        canTrack = true;
      }

      if (canTrack) {
        const clarityId = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;
        if (clarityId) {
          Clarity.initialize(clarityId, {
            logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
          });
          console.log('✅ Clarity initialized safely (ATT Consent Granted or N/A)');
        }
      } else {
        console.log('❌ Tracking explicitly denied by user, Clarity NOT initialized.');
      }
    };

    const initAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('✅ Global audio configured for background playback');
      } catch (e) {
        console.warn('⚠️ Failed to set global audio mode', e);
      }
    };

    initTracking();
    initAudio();
  }, []);
};
