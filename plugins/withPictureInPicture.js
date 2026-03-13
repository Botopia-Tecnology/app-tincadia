const {
    withAndroidManifest,
    createRunOncePlugin,
} = require('@expo/config-plugins');

const withAndroidPictureInPicture = (config) => {
    return withAndroidManifest(config, async (config) => {
        const mainActivity = config.modResults.manifest.application[0].activity[0];

        // Enable PiP support
        mainActivity.$['android:supportsPictureInPicture'] = 'true';

        const currentConfigChanges = mainActivity.$['android:configChanges'] || '';
        const requiredChanges = [
            'smallestScreenSize',
            'screenLayout',
            'screenSize',
            'orientation'
        ];

        const changesList = currentConfigChanges.split('|');
        requiredChanges.forEach(change => {
            if (!changesList.includes(change)) {
                changesList.push(change);
            }
        });

        mainActivity.$['android:configChanges'] = changesList.filter(Boolean).join('|');

        return config;
    });
};

const withPictureInPicture = (config) => {
    config = withAndroidPictureInPicture(config);
    return config;
};

module.exports = createRunOncePlugin(withPictureInPicture, 'withPictureInPicture', '1.0.0');
