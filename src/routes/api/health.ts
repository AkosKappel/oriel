import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { db } from '#/server/db'

// For container health checks and uptime monitoring.
async function health() {
  try {
    await db.execute(sql`select 1`)
    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'database unavailable' }, { status: 503 })
  }
}

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: health,
      HEAD: async () => new Response(null, { status: (await health()).status }),
    },
  },
})
