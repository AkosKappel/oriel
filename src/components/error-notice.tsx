import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Button } from 'react-aria-components'
import { Logo } from '#/components/logo'
import { reportError } from '#/lib/report-error'

// Thrown when a page's code was never downloaded and the network is gone (Chrome, Safari, Firefox).
const missingCode =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

const linkButton =
  'rounded-sm text-foreground underline underline-offset-4 data-focus-visible:outline-2'

/**
 * What a route shows when its code throws. Local data is never at risk from a rendering error, so
 * the message says so and offers a retry before a reload.
 */
export function ErrorNotice({
  error,
  reset,
  title = 'Something went wrong.',
}: {
  error: unknown
  reset: () => void
  title?: string
}) {
  const router = useRouter()
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const message = error instanceof Error ? error.message : String(error)

  useEffect(() => reportError('Render error', error), [error])

  function retry() {
    reset()
    void router.invalidate()
  }

  return (
    <div role="alert" className="flex flex-col gap-3">
      <h1 className="font-serif text-3xl italic">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {offline && missingCode.test(message)
          ? 'This part of Oriel has not been downloaded to this device yet. It opens once you are back online. '
          : 'Your notes are safe on this device. '}
        <Button onPress={retry} className={linkButton}>
          Try again
        </Button>{' '}
        or{' '}
        <a href="/app" className="text-foreground underline underline-offset-4">
          reload Oriel
        </a>
        .
      </p>
      {message && (
        <details className="max-w-sm text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer py-2 hover:text-foreground">
            Details
          </summary>
          <p className="font-mono break-words">{message}</p>
        </details>
      )}
    </div>
  )
}

/**
 * Shown while a page that renders in the browser starts (also as the server's first paint for those
 * pages). It fades in late (opacity only, so also with reduced motion), so a quick start shows
 * nothing at all instead of a flash.
 */
export function Pending() {
  return (
    <div
      role="status"
      className="flex min-h-dvh animate-[fade-in_300ms_600ms_both] flex-col items-center justify-center gap-4 pb-24 font-serif text-xl text-muted-foreground italic"
    >
      <Logo className="size-10 text-primary" />
      Opening your notebook…
    </div>
  )
}
