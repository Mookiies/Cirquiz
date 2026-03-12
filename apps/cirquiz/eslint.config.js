// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const noRawText = require('./eslint-rules/no-raw-text');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
    },
  },
  {
    plugins: {
      local: { rules: { 'no-raw-text': noRawText } },
    },
    rules: {
      'local/no-raw-text': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
    files: ['**/*.tsx'],
  },
  { ignores: ['dist/*'] },
]);
