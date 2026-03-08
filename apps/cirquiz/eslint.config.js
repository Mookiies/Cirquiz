// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const noRawText = require('./eslint-rules/no-raw-text');

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      local: { rules: { 'no-raw-text': noRawText } },
    },
    rules: {
      'local/no-raw-text': 'error',
    },
    files: ['**/*.tsx'],
  },
  { ignores: ['dist/*'] },
]);
