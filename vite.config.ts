import { paraglideVitePlugin } from '@inlang/paraglide-js'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { serviceWorker } from './scripts/service-worker-plugin'
import { securityHeaders } from './src/lib/security-headers'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // PowerSync ships web workers and WASM that the dependency optimizer would break.
  optimizeDeps: { exclude: ['@powersync/web'] },
  worker: { format: 'es' },
  plugins: [
    devtools(),
    // Messages in `messages/<locale>/*.json`; the language comes from the cookie the Settings
    // choice sets, else the browser's languages, else English. No locale in URLs.
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      emitTsDeclarations: true,
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
    }),
    // Serves gzip and Brotli copies of the built assets (the server does not compress).
    nitro({
      compressPublicAssets: true,
      routeRules: { '/**': { headers: securityHeaders } },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    serviceWorker(),
  ],
})
