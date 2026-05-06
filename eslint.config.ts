import js from "@eslint/js";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsEslintParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import pluginSecurity from "eslint-plugin-security";
import globals from "globals";

export default [
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"]
  },
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsEslintParser,
      parserOptions: {
        project: false,
        sourceType: "module"
      },
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      "@typescript-eslint": tsEslintPlugin,
      import: importPlugin,
      "simple-import-sort": simpleImportSort
    },
    rules: {
      ...tsEslintPlugin.configs.recommended.rules,
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error"
    }
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**", "**/*.test.tsx"],
    rules: {
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-possible-timing-attacks": "off"
    }
  }
];
