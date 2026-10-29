import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { createRateLimit } from '#/server/rate-limit'

const reportSchema = z.object({
  where: z.string().max(100),
  message: z.string().max(1000),
  stack: z.string().max(4000).optional(),
  path: z.string().max(500),
})

// Anyone can call this, signed in or not, so it is limited per address and only ever logs.
const reportLimit = createRateLimit({ windowMs: 60_000, max: 10 })

/**
 * Errors from browsers (`reportError` in src/lib/report-error.ts), written to the server log.
 * Always answers 204: a device has nothing to do with the result.
 */
export const Route = createFileRoute('/api/client-error')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const address =
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          'unknown'
        if (!reportLimit(address).allowed) {
          return new Response(null, { status: 204 })
        }
        // A beacon sends its body as text/plain.
        const report = reportSchema.safeParse(
          await request
            .text()
            .then((text) => JSON.parse(text))
            .catch(() => null),
        )
        if (report.success) {
          // One JSON line, like the request log.
          console.error(
            JSON.stringify({
              clientError: report.data,
              userAgent: request.headers.get('user-agent')?.slice(0, 300),
            }),
          )
        }
        return new Response(null, { status: 204 })
      },
    },
  },
})
