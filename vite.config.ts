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
      strategy: ['cookie', 'baseLocale'],
    }),
    tailwindcss(),
    tanstackStart(),
    // PWA support: tried `vite-plugin-pwa` (`generateSW`) here first, but
    // its `closeBundle` hook — which is what actually writes `sw.js` and
    // is gated on `!viteConfig.build.ssr` — never fires for either of
    // TanStack Start's Vite Environment API build passes (`client`, `ssr`);
    // both `pnpm build` and `pnpm build:vercel` complete successfully but
    // silently produce no service worker at all. Rather than fight the
    // plugin/environment-API integration, this falls back to a
    // hand-written `public/sw.js` (plain static asset, copied through
    // as-is) registered from `src/components/PwaRegister.tsx` — see that
    // file and `public/sw.js` for the full writeup, and
    // `.interface-design/system.md`'s PWA decision log.
    ...(target === 'vercel' ? [nitro({ preset: 'vercel' })] : []),
    viteReact(),
  ],
})

export default config
