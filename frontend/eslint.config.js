import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      // Catches the class of problem this branch just fixed by hand:
      // unnamed controls, non-interactive elements with handlers, bad roles.
      jsxA11y.flatConfigs.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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
          selector: "Literal[value=/^#e10600$/i]",
          message: 'Use BRAND_RED from theme/tokens (or the `primary.main` palette entry).',
        },
        {
          selector: "Literal[value=/^#1e1e1e$/i]",
          message: 'Use PAPER_BG from theme/tokens.',
        },
        {
          selector: "Literal[value=/Titillium Web/]",
          message: 'Use FONT_FAMILY from theme/tokens, or let the theme supply it.',
        },
      ],
    },
  },
])
