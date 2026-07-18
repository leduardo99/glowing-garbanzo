import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The deployment target only matters at build time and only changes what
 * `pnpm build:vercel` (as opposed to the default `pnpm build`) produces —
 * `DEPLOY_TARGET` is unset for local dev/build/CI, so the Nitro plugin (and its
 * `vercel` preset) is only pulled in when explicitly requested. This keeps
 * `pnpm build`/`pnpm dev` behavior byte-for-byte unchanged.
 *
 * See DEPLOY.md for the Vercel setup this feeds into.
 */
const target = process.env.DEPLOY_TARGET

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['url', 'baseLocale'],
    }),
    tailwindcss(),
    tanstackStart(),
    ...(target === 'vercel' ? [nitro({ preset: 'vercel' })] : []),
    viteReact(),
  ],
})

export default config
