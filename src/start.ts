import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'
import { loggablePath } from '#/server/request-log'

// One JSON line per request in production, for `docker compose logs app`. Errors keep their
// stack trace; the request id is also sent back, so a report from a user can be matched.
const requestLog = createMiddleware().server(async ({ request, next }) => {
  if (!import.meta.env.PROD) return next()
  const started = performance.now()
  const id = crypto.randomUUID()
  setResponseHeaders(new Headers({ 'X-Request-Id': id }))
  const entry = { id, method: request.method, path: loggablePath(request.url) }
  try {
    const result = await next()
    console.log(
      JSON.stringify({
        ...entry,
        status: result.response.status,
        ms: Math.round(performance.now() - started),
      }),
    )
    return result
  } catch (error) {
    const ms = Math.round(performance.now() - started)
    // The browser went away (closed tab, cancelled fetch): not a server error.
    if (request.signal.aborted) {
      console.log(JSON.stringify({ ...entry, status: 499, ms }))
    } else {
      console.error(
        JSON.stringify({
          ...entry,
          status: 500,
          ms,
          error: error instanceof Error ? error.stack : String(error),
        }),
      )
    }
    throw error
  }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLog],
}))
