import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '#/server/db'
import { items, noteVersion, spaceMember } from '#/server/db/schema'

const keepDays = 90

/**
 * The saved versions of an item's text, newest first, for a member of its space. Versions older
 * than `keepDays` are dropped on the way.
 */
export async function listVersions(actorId: string, itemId: string) {
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select({ role: spaceMember.role })
      .from(items)
      .innerJoin(
        spaceMember,
        and(
          eq(spaceMember.spaceId, items.spaceId),
          eq(spaceMember.userId, actorId),
        ),
      )
      .where(eq(items.id, itemId))
    if (!member) throw new Error('This item is not shared with you.')

    const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000)
    await tx
      .delete(noteVersion)
      .where(
        and(eq(noteVersion.itemId, itemId), lt(noteVersion.savedAt, cutoff)),
      )
    return tx
      .select({
        id: noteVersion.id,
        body: noteVersion.body,
        savedAt: noteVersion.savedAt,
        savedBy: noteVersion.savedBy,
      })
      .from(noteVersion)
      .where(eq(noteVersion.itemId, itemId))
      .orderBy(desc(noteVersion.savedAt))
      .limit(50)
  })
}
