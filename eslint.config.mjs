import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    rules: {
      // Reglas personalizadas aquí si es necesario
    },
  },
  // Override default ignores
  globalIgnores([
    ".expo/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    ".expo-shared/**",
  ]),
]);

export default eslintConfig;

