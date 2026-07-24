import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'public/**',
      'supabase/.temp/**',
      'supabase/migrations/**',
      'supabase/tests/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Test-local components are lightweight fixtures, not production modules.
      'vue/one-component-per-file': 'off',
    },
  },
  {
    files: ['supabase/functions/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        Deno: 'readonly',
      },
    },
  },
  {
    files: ['scripts/**/*.mjs', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: [
      'scripts/**/*.mjs',
      'src/**/*.{ts,vue}',
      'supabase/functions/**/*.ts',
      'vite.config.ts',
    ],
    plugins: {
      import: importPlugin,
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-unneeded-ternary': 'warn',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'import/order': [
        'warn',
        {
          alphabetize: {
            caseInsensitive: true,
            order: 'asc',
          },
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          pathGroups: [
            {
              group: 'external',
              pattern: 'vue',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['vue'],
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          varsIgnorePattern: '^_',
        },
      ],
      'vue/attributes-order': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
    },
  },
  eslintConfigPrettier,
);
