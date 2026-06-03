import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

// Flat config — the enforcement teeth for docs/architecture/modularity.md.
// Hard rules: 300-line cap (error), function length + complexity (warn),
// and the layer import-boundaries (web↛api, domain↛data/http/Prisma,
// controllers↛Prisma). See appendices/config-lint.md.
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.tsbuild/**',
      '**/node_modules/**',
      '**/*.generated.*',
      'packages/**/prisma/migrations/**',
      'packages/**/node_modules/.prisma/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // Type-aware parsing only for TS source.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['vitest.workspace.ts', 'playwright.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // --- project-wide rules (modularity + boundaries) ---
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    rules: {
      // allow intentionally-unused args/vars when prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // file-size discipline (HARD requirement)
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 12],

      // web must never import the api package (it is an API client)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@macronome/api', '@macronome/api/*'],
              message: 'web is an API client; call /api instead.',
            },
          ],
        },
      ],
    },
  },

  // domain purity: no Prisma / http / data imports inside domain
  {
    files: ['packages/api/src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/**', '**/http/**', '@prisma/client'],
              message: 'domain/* is pure: take inputs, return outputs. No I/O.',
            },
          ],
        },
      ],
    },
  },

  // controllers stay thin: no direct Prisma
  {
    files: ['packages/api/src/http/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '**/data/prisma*'],
              message: 'controllers call services, not Prisma.',
            },
          ],
        },
      ],
    },
  },

  // exemption from the size rule for generated TS (locale JSON / tokens.css are
  // not linted by ESLint, so listing them here would wrongly opt them in).
  {
    files: ['**/*.generated.ts'],
    rules: { 'max-lines': 'off' },
  },

  // tests: assertions probe `any` response bodies — relax the unsafe-* rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // plain JS (config files, scripts): node globals, no type-aware rules
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  // browser globals for the web package
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
);
