import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import importX from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import { createRequire } from 'node:module';

// eslint-plugin-react's `version: 'detect'` calls context.getFilename(),
// removed in ESLint 10 — it throws before linting a single file. Reading the
// installed version here avoids that code path without hard-coding a number
// that would silently drift from the dependency.
const reactVersion = createRequire(import.meta.url)('react/package.json').version;

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'blob-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      // The type-aware tier, not the syntactic one. `recommended` alone has no
      // no-floating-promises, no-misused-promises or await-thenable — exactly
      // the rules that catch the async mistakes an Axios + STOMP + Auth0 app is
      // prone to, and the reason `strict` in tsconfig was only ever enforced by
      // tsc rather than at review time.
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      react.configs.flat.recommended,
      // The app is on the automatic JSX runtime; without this, every file is
      // reported for not importing React.
      react.configs.flat['jsx-runtime'],
      jsxA11y.flatConfigs.recommended,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // Was 2020, against an ES2022 compile target — a leftover from the Vite
      // template that quietly forbade syntax the build accepts.
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        // Resolves each file to whichever of the three tsconfigs owns it, so
        // the type-aware rules work across src, the configs and e2e without a
        // fourth "lint only" tsconfig to keep in sync.
        projectService: {
          // eslint.config.js and .size-limit.js belong to no tsconfig.
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: reactVersion },
      // import-x 4's flatConfigs.typescript only declares `{ typescript: true }`
      // and expects the resolver package to be present; without this it reports
      // every single import as unresolved, which then makes no-cycle,
      // namespace and default meaningless too.
      //
      // The TypeScript resolver rather than the node one because it reads
      // tsconfig `paths`, which is where the `@/` alias lives.
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          // The root tsconfig, which is solution-style: it has no files of its
          // own and just references the three real ones. Listing those three
          // directly works but makes the resolver warn about multiple projects.
          project: 'tsconfig.json',
        }),
      ],
    },
    rules: {
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'ignore',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Every `||` this flagged is a deliberate empty-string fallback —
      // `teamColour || DEFAULT_TEAM_COLOUR` exists so `''` never reaches
      // ctx.strokeStyle, and `driverCode || 'N/A'` so a blank code never
      // renders as a blank label. `??` would pass the empty string through, so
      // applying the rule's fix would introduce the bugs these guard against.
      // It stays on for objects and numbers, where the distinction usually is a
      // mistake.
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true, boolean: true } },
      ],
      'import-x/no-cycle': 'error',
      // TypeScript already resolves and checks these, and does it correctly:
      // import-x reports React 19's `export = React` types as having no default
      // export, which is 33 false positives and no true ones. Leaving them on
      // would mean the first thing anyone learns about this config is which of
      // its errors to ignore.
      'import-x/default': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-duplicates': 'error',
      // 24 imports carried a .tsx suffix and 111 did not; the bundler accepts
      // both, so nothing made them agree.
      'import-x/extensions': ['error', 'never', { json: 'always', css: 'always' }],
    },
  },
  {
    // Tests assert on deliberately malformed data — a schema rejection test has
    // to hand the parser something the types forbid — so the unsafe-* family is
    // noise here rather than signal.
    files: ['src/**/__tests__/**/*.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    extends: [vitest.configs.recommended],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // `expect(client.post)` and `vi.fn()` mocks are unbound methods and empty
      // functions by construction — 97 reports, none of them a bug. These stay
      // on for application code, where they mean something.
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // An async test body with no await is how vitest tests that a promise
      // rejects synchronously; the rule cannot tell that from a mistake.
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    // Playwright specs run in Node and are not vitest, so they get the node
    // globals and none of the vitest rules.
    files: ['e2e/**/*.ts', 'playwright.config.ts', 'vite.config.ts', '.size-limit.js'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    // `m` renders from framer's core; `motion` statically pulls in the whole
    // feature set, which is the 40 kB the LazyMotion split exists to defer.
    // LazyMotion's `strict` catches this too, but only when the component
    // actually renders — and in production it throws rather than warns. This
    // catches it at lint time instead.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/motionFeatures.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'framer-motion',
              importNames: ['motion', 'domMax', 'domAnimation'],
              message:
                'Import `m` instead of `motion`, and let src/motionFeatures.ts own the feature bundle — see the LazyMotion wrapper in App.tsx.',
            },
          ],
        },
      ],
    },
  },
  {
    // Design tokens are only worth centralising if they stay centralised.
    // src/theme/ is where the values are allowed to be written literally.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/theme/**', 'src/**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#e10600$/i]',
          message: 'Use BRAND_RED from theme/tokens (or the `primary.main` palette entry).',
        },
        {
          selector: 'Literal[value=/^#1e1e1e$/i]',
          message: 'Use PAPER_BG from theme/tokens.',
        },
        {
          selector: 'Literal[value=/Titillium Web/]',
          message: 'Use FONT_FAMILY from theme/tokens, or let the theme supply it.',
        },
      ],
    },
  },
  // Last, so it wins: turns off every ESLint rule that overlaps with Prettier.
  // Without it the two disagree about the same line and `--fix` and `--write`
  // undo each other on every save.
  prettier,
]);
