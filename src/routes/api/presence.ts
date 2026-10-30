import { createFileRoute } from '@tanstack/react-router'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '#/server/auth'
import { db } from '#/server/db'
import { items, space, spaceMember } from '#/server/db/schema'
import { connectionsOf, join } from '#/server/presence'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// A person with many tabs open is fine; hundreds of streams are not.
const maxStreams = 20
const heartbeatMs = 25_000

/**
 * Server-sent events with the names of the other members who have a shared item open: a JSON
 * array on arrival and whenever someone comes or goes. Members only; personal items have nobody
 * to show and get 204.
 */
export const Route = createFileRoute('/api/presence')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const itemId = new URL(request.url).searchParams.get('item') ?? ''
        if (!uuidPattern.test(itemId)) {
          return Response.json({ error: 'Unknown item' }, { status: 400 })
        }
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return Response.json({ error: 'Not signed in' }, { status: 401 })
        }
        const userId = session.user.id
        const [member] = await db
          .select({ name: spaceMember.memberName })
          .from(items)
          .innerJoin(
            space,
            and(eq(space.id, items.spaceId), isNull(space.personalOwnerId)),
          )
          .innerJoin(
            spaceMember,
            and(
              eq(spaceMember.spaceId, items.spaceId),
              eq(spaceMember.userId, userId),
            ),
          )
          .where(eq(items.id, itemId))
        if (!member) return new Response(null, { status: 204 })
        if (connectionsOf(userId) >= maxStreams) {
          return Response.json({ error: 'Too many open' }, { status: 429 })
        }

        const encoder = new TextEncoder()
        let stop = () => {}
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const write = (text: string) => {
              try {
                controller.enqueue(encoder.encode(text))
              } catch {
                stop()
              }
            }
            const leave = join(itemId, {
              userId,
              name: member.name,
              send: (others) => write(`data: ${JSON.stringify(others)}\n\n`),
            })
            // A comment line now and then keeps proxies from closing a quiet stream.
            const heartbeat = setInterval(
              () => write(': ping\n\n'),
              heartbeatMs,
            )
            stop = () => {
              clearInterval(heartbeat)
              leave()
              stop = () => {}
            }
            request.signal.addEventListener('abort', () => {
              stop()
              try {
                controller.close()
              } catch {
                // Already closed.
              }
            })
          },
          cancel: () => stop(),
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
            // nginx would otherwise hold the events back in its buffer.
            'X-Accel-Buffering': 'no',
          },
        })
      },
    },
  },
})
