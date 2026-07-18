//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/paraglide/',
      '.vercel/',
      // Plain static asset served as-is (service worker script, not part
      // of the TS project) — see public/sw.js's own header comment.
      'public/sw.js',
      // Vendored agent-skill tooling (impeccable/interface-design scripts)
      // — plain Node/browser scripts outside this app's `tsconfig`
      // project, not product source. Pre-existing `pnpm lint` failure
      // fixed here (mobile-app-ux redesign task's gate requirement),
      // unrelated to any behavior change.
      '.agents/',
    ],
  },
]
