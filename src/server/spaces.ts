import { eq } from 'drizzle-orm'
import { db } from '#/server/db'
import { space, spaceMember, user } from '#/server/db/schema'

/**
 * Returns the user's personal space, creating it with its owner membership if it does not exist
 * yet. Safe to call any number of times, also concurrently: the unique `personal_owner_id` lets
 * only one insert win.
 */
export async function ensurePersonalSpace(userId: string) {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(space)
      .values({ name: 'Personal', personalOwnerId: userId })
      .onConflictDoNothing({ target: space.personalOwnerId })
      .returning({ id: space.id })

    if (created) {
      const [owner] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, userId))
      await tx.insert(spaceMember).values({
        spaceId: created.id,
        userId,
        role: 'owner',
        memberName: owner.name,
      })
      return created.id
    }

    const [existing] = await tx
      .select({ id: space.id })
      .from(space)
      .where(eq(space.personalOwnerId, userId))
    return existing.id
  })
}
