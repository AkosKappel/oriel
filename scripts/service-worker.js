// Template: `scripts/service-worker-plugin.ts` fills in the version and the precache list and emits
// the result as `sw.js` with the client build.
const version = '__VERSION__'
const precache = __PRECACHE__
// The server's page for `/` boots the app for any URL, because every route renders on the client.
const shell = '/'
const precacheName = `oriel-${version}`
const runtimeName = 'oriel-runtime'

self.addEventListener('install', (event) => {
  // No skipWaiting here: the page asks for it when the user chooses to reload.
  event.waitUntil(
    caches.open(precacheName).then((cache) => cache.addAll(precache)),
  )
})

self.addEventListener('activate', (event) => {
  // Old hashed assets are never requested again, so both old caches can go.
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== precacheName)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Sync shares the origin in production (nginx /powersync/); it must never come from a cache.
  if (url.pathname.startsWith('/powersync/')) return

  // Pages: the server when online, the cached shell when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(shell).then((response) => response ?? Response.error()),
      ),
    )
    return
  }

  // Everything else that was precached, or a hashed asset (the SQLite WASM is cached on first
  // use instead of precaching all of its variants).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && url.pathname.startsWith('/assets/')) {
          const copy = response.clone()
          caches.open(runtimeName).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
