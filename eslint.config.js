import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // noUncheckedIndexedAccess makes index reads optional; '!' after a bounds check is intended.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Zero network: block network APIs at lint time too (privacy-check is the hard gate).
      'no-restricted-globals': ['error', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon' },
        { object: 'window', property: 'fetch' },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
);
