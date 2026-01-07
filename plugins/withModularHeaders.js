const { withPodfile } = require("expo/config-plugins");

const withModularHeaders = (config) => {
  return withPodfile(config, (config) => {
    const podfileContent = config.modResults.contents;

    // List of pods that require modular headers for Firebase to work correctly with Swift
    const pods = [
      "p 'GoogleUtilities', :modular_headers => true",
      "p 'FirebaseCore', :modular_headers => true",
      "p 'FirebaseInstallations', :modular_headers => true",
      "p 'FirebaseCoreInternal', :modular_headers => true"
    ];

    // Using 'pod' instead of 'p' prefix for clarity in string, strict ruby syntax
    const podLines = `
pod 'GoogleUtilities', :modular_headers => true
pod 'FirebaseCore', :modular_headers => true
pod 'FirebaseInstallations', :modular_headers => true
pod 'FirebaseCoreInternal', :modular_headers => true
`;

    // Avoid duplicating if already present (checking just the first one as a heuristic or check properly)
    // We will clean up previous injection if simple string check matches, or just append distinctively.
    // For simplicity in this iteration, we just check if "FirebaseCore" is present in the override section.
    if (!podfileContent.includes("pod 'FirebaseCore', :modular_headers => true")) {
      // If we previously added GoogleUtilities, we might want to replace it or just append the missing ones.
      // It's safer to just append the full block, Podfile usually allows duplicate declarations (last wins or warns) 
      // but cleaner to not duplicate.
      // Let's just append the new block.
      config.modResults.contents = podfileContent + podLines;
    }

    return config;
  });
};

module.exports = withModularHeaders;
