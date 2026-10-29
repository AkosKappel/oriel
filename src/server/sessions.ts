import { and, desc, eq, gt } from 'drizzle-orm'
import { describeDevice } from '#/lib/devices'
import { db } from '#/server/db'
import { session } from '#/server/db/schema'

// Better Auth's own `listSessions` only answers for sessions younger than a day (`freshAge`),
// and it hands session tokens to the browser. These read the table directly and expose ids only.

/** The user's active sessions, newest first, with the one making the request marked. */
export async function listDevices(userId: string, currentSessionId: string) {
  const rows = await db
    .select({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
    })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.createdAt))
  return rows.map((row) => ({
    id: row.id,
    device: describeDevice(row.userAgent),
    signedInAt: row.createdAt.toISOString(),
    current: row.id === currentSessionId,
  }))
}

/** Ends one of the user's own sessions; another user's session id does nothing. */
export async function signOutDevice(userId: string, sessionId: string) {
  await db
    .delete(session)
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
}
