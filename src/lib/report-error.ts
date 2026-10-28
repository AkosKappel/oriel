/**
 * Logs an error in the console and sends it to the server's log (`/api/client-error`), so
 * failures on people's devices show up without third-party tracking. Best effort: offline, or
 * when the browser drops the beacon, the console line is all there is.
 */
export function reportError(where: string, error: unknown) {
  console.error(where, error)
  if (typeof navigator === 'undefined' || !navigator.onLine) return
  const details =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { message: String(error) }
  navigator.sendBeacon(
    '/api/client-error',
    JSON.stringify({
      where,
      message: details.message.slice(0, 1000),
      stack: details.stack?.slice(0, 4000),
      // The path only: search params can hold what someone searched for.
      path: location.pathname.slice(0, 500),
    }),
  )
}
