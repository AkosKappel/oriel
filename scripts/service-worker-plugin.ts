import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Plugin } from 'vite'

// Each SQLite WASM variant is large and only one is used; the service worker caches that one on
// first use instead. Source maps are never needed offline.
const skipped = /\.(wasm|map)$/

// Server-rendered pages, cached as they are; every other page is the app's shell (`/app`).
const publicPages = [
  '/',
  '/about',
  '/faq',
  '/privacy',
  '/terms',
  '/accessibility',
]

function publicFiles(dir: string) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
}

/**
 * Emits `sw.js` with the client build, listing every built and public file to precache. Emitting it
 * here (not after the build) puts it in Nitro's static file list, so the server serves it.
 */
export function serviceWorker(): Plugin {
  return {
    name: 'oriel:service-worker',
    apply: 'build',
    applyToEnvironment: (environment) => environment.name === 'client',
    generateBundle(_options, bundle) {
      const publicDir = this.environment.config.publicDir
      const files = [...Object.keys(bundle), ...publicFiles(publicDir)]
        .filter((file) => !skipped.test(file))
        .sort()

      // Built file names carry content hashes; public files are hashed by content here.
      const hash = createHash('sha256')
      for (const file of files) hash.update(file)
      for (const file of publicFiles(publicDir)) {
        hash.update(readFileSync(join(publicDir, file)))
      }
      const version = hash.digest('hex').slice(0, 12)

      const template = readFileSync('scripts/service-worker.js', 'utf8')
      const precache = [
        ...publicPages,
        '/app',
        ...files.map((file) => `/${file}`),
      ]
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace("'__VERSION__'", JSON.stringify(version))
          .replace('__PRECACHE__', JSON.stringify(precache))
          .replace('__PUBLIC_PAGES__', JSON.stringify(publicPages)),
      })
    },
  }
}
