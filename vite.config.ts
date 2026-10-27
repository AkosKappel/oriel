import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { serviceWorker } from './scripts/service-worker-plugin'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // PowerSync ships web workers and WASM that the dependency optimizer would break.
  optimizeDeps: { exclude: ['@powersync/web'] },
  worker: { format: 'es' },
  plugins: [
    devtools(),
    // Serves gzip and Brotli copies of the built assets (the server does not compress).
    nitro({ compressPublicAssets: true }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    serviceWorker(),
  ],
})
