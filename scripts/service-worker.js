// Template: `scripts/service-worker-plugin.ts` fills in the version, the precache list and the public
// pages, and emits the result as `sw.js` with the client build.
const version = '__VERSION__'
const precache = __PRECACHE__
const publicPages = __PUBLIC_PAGES__
// The server's page for `/app` boots the app for any app URL, because those routes render on the
// client. The public pages are cached as they are.
const appShell = '/app'
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
  // API calls are live by nature (presence is a stream that never ends); never cache them.
  if (url.pathname.startsWith('/api/')) return

  // Pages: the server when online; offline, a public page as cached, anything else the app shell.
  if (request.mode === 'navigate') {
    const offline = publicPages.includes(url.pathname) ? url.pathname : appShell
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(offline).then((response) => response ?? Response.error()),
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

// Notifications (src/server/notifications.ts): the server sends title, body, a page to open and a
// tag, so a later reminder replaces an unread one instead of piling up.
self.addEventListener('push', (event) => {
  const message = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(message.title ?? 'Oriel', {
      body: message.body,
      tag: message.tag,
      icon: '/icon-192.png',
      data: { url: message.url ?? '/app' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(
    event.notification.data?.url ?? '/app',
    self.location.origin,
  )
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find(
          (client) => new URL(client.url).origin === url.origin,
        )
        if (open) return open.focus().then(() => open.navigate(url.href))
        return self.clients.openWindow(url.href)
      }),
  )
})
