import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  ScriptOnce,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { type CSSProperties, type ReactNode, useEffect } from 'react'
import { Toaster } from 'sonner'
import { ErrorNotice } from '#/components/error-notice'
import { OfflineBanner } from '#/components/offline-banner'
import { SubPage } from '#/components/sub-page'
import { useFocusAfterNavigation } from '#/lib/route-focus'
import { contentSecurityPolicy } from '#/lib/security-headers'
import { pageMeta } from '#/lib/seo'
import { registerServiceWorker } from '#/lib/service-worker'
import { themeScript, useTheme } from '#/lib/theme'
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
      ...pageMeta('Oriel', 'One calm place for notes, lists and tasks.'),
      { property: 'og:site_name', content: 'Oriel' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
      { name: 'apple-mobile-web-app-title', content: 'Oriel' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  // Pages only, and only in production builds: Vite's development scripts carry no nonce.
  headers: ({ ssr }) =>
    import.meta.env.PROD && ssr?.nonce
      ? {
          'Content-Security-Policy': contentSecurityPolicy(
            ssr.nonce,
            process.env.POWERSYNC_URL,
          ),
        }
      : undefined,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ErrorPage,
})

// The capture bar's height already includes the safe area.
const toastLift =
  'max(calc(var(--capture-height, 0px) + 0.75rem), 1rem, env(safe-area-inset-bottom))'

function RootDocument({ children }: { children: ReactNode }) {
  useEffect(registerServiceWorker, [])
  useFocusAfterNavigation()
  const theme = useTheme()

  return (
    // The theme script sets `data-theme` before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Here rather than in `head`, which keeps only one meta per name. */}
        <meta
          name="theme-color"
          content="#faf6ef"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#141820"
          media="(prefers-color-scheme: dark)"
        />
        {/* Carries the page's CSP nonce and removes itself before React hydrates. */}
        <ScriptOnce>{themeScript}</ScriptOnce>
      </head>
      <body>
        <OfflineBanner />
        {children}
        {/* Just above the capture bar when it is shown, where the thumb already is for Undo. */}
        <Toaster
          position="bottom-center"
          theme={theme}
          // One message at a time; quick capture would otherwise stack them.
          visibleToasts={1}
          offset={{ bottom: toastLift }}
          mobileOffset={{ bottom: toastLift }}
          style={
            {
              '--normal-bg': 'var(--background)',
              '--normal-text': 'var(--foreground)',
              '--normal-border': 'var(--rule)',
            } as CSSProperties
          }
          toastOptions={{
            classNames: {
              toast: '!font-sans',
              actionButton: '!bg-foreground !text-background',
            },
          }}
        />
        <TanStackDevtools
          // Hidden until hovered, so it never covers the app's own controls.
          config={{ position: 'bottom-right', hideUntilHover: true }}
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
    <SubPage>
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-3xl italic">No such page.</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The link may be mistyped, or the page was moved.
        </p>
      </div>
    </SubPage>
  )
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <SubPage>
      <ErrorNotice error={error} reset={reset} />
    </SubPage>
  )
}
