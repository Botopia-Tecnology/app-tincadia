const { withPodfile } = require("expo/config-plugins");

const withModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    const podfileContent = config.modResults.contents;

    // Build settings to inject
    const buildSettingsLogic = `
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
`;

    const podLines = `
pod 'GoogleUtilities', :modular_headers => true
pod 'FirebaseCore', :modular_headers => true
pod 'FirebaseInstallations', :modular_headers => true
pod 'FirebaseCoreInternal', :modular_headers => true
`;

    let newContent = podfileContent;

    // 1. Add Pods (if not present)
    if (!newContent.includes("'GoogleUtilities', :modular_headers => true")) {
      newContent += podLines;
    }

    // 2. Add post_install block or inject into existing
    if (newContent.includes("post_install do |installer|")) {
      // Find the line with "installer.pods_project.targets.each do |target|" inside post_install
      // Expo's default post_install usually has this loop.
      const targetLoopStart = "installer.pods_project.targets.each do |target|";

      if (newContent.includes(targetLoopStart)) {
        // Inject right after the target loop starts
        newContent = newContent.replace(
          targetLoopStart,
          `${targetLoopStart}\n${buildSettingsLogic}`
        );
      } else {
        // Loop not found (unlikely in Expo), try to inject at start of post_install
        newContent = newContent.replace(
          "post_install do |installer|",
          `post_install do |installer|\n  installer.pods_project.targets.each do |target|\n${buildSettingsLogic}\n  end\n`
        );
      }
    } else {
      // No post_install hook found, add a complete new one
      newContent += `
post_install do |installer|
  installer.pods_project.targets.each do |target|
${buildSettingsLogic}
  end
end
`;
    }

    config.modResults.contents = newContent;

    return config;
  });
};

module.exports = withModularHeaders;
