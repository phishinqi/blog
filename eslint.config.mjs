import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import hooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'public/admin/vendor/**',
      'public/admin/**',
      '.reports/**',
      '.wrangler/**',
      '.scratch/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['**/*.tsx'],
    plugins: { 'react-hooks': hooks, 'jsx-a11y-x': jsxA11y },
    rules: { ...hooks.configs.recommended.rules, ...jsxA11y.configs.recommended.rules },
  },
  { files: ['**/*.astro'], languageOptions: { parserOptions: { parser: tseslint.parser } } },
);
