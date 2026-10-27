import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  createRootRoute,
  HeadContent,
  Link,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import type { CSSProperties, ReactNode } from 'react'
import { Toaster } from 'sonner'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // `resizes-content` keeps the capture bar above the on-screen keyboard on Android.
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content',
      },
      { title: 'Oriel' },
      {
        name: 'description',
        content: 'One calm place for notes, lists and tasks.',
      },
      {
        name: 'theme-color',
        content: '#f8f6f1',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#1c1a17',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {/* Just above the capture bar, where the thumb already is for Undo. */}
        <Toaster
          position="bottom-center"
          theme="system"
          offset={{ bottom: 136 }}
          mobileOffset={{ bottom: 136 }}
          style={
            {
              '--normal-bg': 'var(--popover)',
              '--normal-text': 'var(--popover-foreground)',
              '--normal-border': 'var(--border)',
            } as CSSProperties
          }
          toastOptions={{
            classNames: {
              toast: '!font-sans',
              actionButton: '!bg-primary !text-primary-foreground',
            },
          }}
        />
        <TanStackDevtools
          config={{ position: 'top-right' }}
          plugins={[
            {
              name: 'TanStack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">
        <Link to="/" className="underline underline-offset-4">
          Back to Oriel
        </Link>
      </p>
    </main>
  )
}
