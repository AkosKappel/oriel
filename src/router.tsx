import { createRouter } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { Pending } from '#/components/error-notice'
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
    defaultPendingComponent: Pending,
    // A quick crossfade when the page changes (opening an item, going back). Filters and search
    // only change the query string, and typing must not wait for a transition. While one runs,
    // the browser hit-tests its snapshot, so a tap in those 160 ms is lost; with reduced motion
    // there is none at all.
    defaultViewTransition: {
      types: ({ pathChanged }) =>
        pathChanged && !matchMedia('(prefers-reduced-motion: reduce)').matches
          ? ['page']
          : false,
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
