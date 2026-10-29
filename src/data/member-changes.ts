import type { Item } from './schema'

/**
 * What other members did between two versions of the items, as sentences for a screen reader:
 * "Anna added Groceries", "Ben finished Fix the tap". Changes by `me` are left out (the person
 * made them and saw them happen), and so are people `nameOf` does not know.
 */
export function describeMemberChanges(
  before: Map<string, Item>,
  after: Item[],
  me: string,
  nameOf: (item: Item, userId: string | null) => string | undefined,
) {
  const messages: string[] = []
  for (const item of after) {
    if (item.deleted_at) continue
    const previous = before.get(item.id)
    if (!previous) {
      const name = item.created_by !== me && nameOf(item, item.created_by)
      if (name) messages.push(`${name} added ${item.title}`)
    } else if (item.completed_at && !previous.completed_at) {
      const name = item.completed_by !== me && nameOf(item, item.completed_by)
      if (name) messages.push(`${name} finished ${item.title}`)
    }
  }
  return messages
}

/** One announcement: a few changes by name, a large batch (such as a first sync) as a count. */
export function announce(messages: string[]) {
  if (messages.length > 3) return `${messages.length} changes from others`
  return messages.join('. ')
}
