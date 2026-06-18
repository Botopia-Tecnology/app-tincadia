const { withAndroidManifest } = require('expo/config-plugins');

/**
 * This plugin runs AFTER expo-notifications and removes the
 * conflicting FCM notification color meta-data that expo-notifications
 * injects, which clashes with @react-native-firebase/messaging's own
 * AndroidManifest declaration of the same key.
 *
 * Instead of trying to add tools:replace (which only works on the main
 * manifest, not the debug overlay), we simply REMOVE the duplicate
 * entry that expo-notifications added, letting Firebase Messaging's
 * own value win.
 */
module.exports = function withFirebaseManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application?.[0];
    if (!application || !application['meta-data']) {
      return config;
    }

    // Remove the expo-notifications FCM color entry to avoid conflict
    // with @react-native-firebase/messaging which declares the same key
    application['meta-data'] = application['meta-data'].filter((item) => {
      return item.$['android:name'] !== 'com.google.firebase.messaging.default_notification_color';
    });

    return config;
  });
};
