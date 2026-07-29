import expoConfig from 'eslint-config-expo/flat.js';

export default [
    {
        ignores: [
            ".expo/**",
            "node_modules/**",
            "dist/**",
            "build/**",
            ".expo-shared/**",
            "android/**",
            "ios/**",
        ],
    },
    ...expoConfig,
    {
        rules: {
            // Reglas personalizadas aquí si es necesario
        },
    },
];
