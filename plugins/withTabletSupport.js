const { withAndroidManifest } = require('@expo/config-plugins');
module.exports = function withTabletSupport(config) {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;
    const manifest = androidManifest.manifest;
    // Asegurar namespace de tools para poder hacer merges
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    const application = manifest.application[0];
    // 1. Sobrescribir la Activity de MLKit para remover el PORTRAIT (Warning de Play Console)
    if (!application.activity) {
      application.activity = [];
    }
    const mlkitActivityName = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';
    let mlkitActivity = application.activity.find(a => a.$['android:name'] === mlkitActivityName);
    if (!mlkitActivity) {
      application.activity.push({
        $: {
          'android:name': mlkitActivityName,
          'tools:node': 'merge',
          'tools:remove': 'android:screenOrientation'
        }
      });
    } else {
      mlkitActivity.$['tools:remove'] = 'android:screenOrientation';
    }
    // 2. Relajar requerimientos de Hardware (Causa principal del bloqueo en tablets)
    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }
    const featuresToRelax = [
      'android.hardware.telephony', // Tablets WiFi no tienen antena celular
      'android.hardware.camera',    // Algunas tablets no tienen cámara
      'android.hardware.camera.autofocus'
    ];
    for (const feature of featuresToRelax) {
      const exists = manifest['uses-feature'].find(
        (f) => f.$['android:name'] === feature
      );
      if (exists) {
        exists.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': feature,
            'android:required': 'false',
          },
        });
      }
    }
    return config;
  });
};
