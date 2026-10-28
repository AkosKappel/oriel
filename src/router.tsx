import { createRouter } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { routeTree } from './routeTree.gen'

// A fresh nonce per server render (getRouter runs once per request); the Content-Security-Policy
// set by the root route allows only scripts that carry it.
const ssrOptions = createIsomorphicFn().server(() => ({
  nonce: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    'base64',
  ),
}))

export function getRouter() {
  return createRouter({
    routeTree,
    ssr: ssrOptions(),
    scrollRestoration: true,
    defaultPreload: 'intent',
    // A quick crossfade when the page changes (opening an item, going back). Filters and search
    // only change the query string, and typing must not wait for a transition.
    defaultViewTransition: {
      types: ({ pathChanged }) => (pathChanged ? ['page'] : false),
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
