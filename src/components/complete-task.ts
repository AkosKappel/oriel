import { toast } from 'sonner'
import type { Item } from '#/data/schema'
import type { Store } from '#/data/store'
import { formatShortDate } from '#/lib/dates'
import { m } from '#/paraglide/messages.js'

/**
 * Finishes or reopens a task. A repeating task moves on to its next due day instead, which a
 * toast says, with Undo. Returns whether it moved on.
 */
export async function completeTask(
  store: Store,
  item: Item,
  completed: boolean,
) {
  const next = await store.setItemCompleted(item.id, completed)
  if (next === undefined) return false
  toast(
    m.next_due({
      title: item.title,
      date: formatShortDate(`${next}T12:00:00`),
    }),
    {
      action: {
        label: m.undo(),
        onClick: () => void store.setItemDue(item.id, item.due_on),
      },
    },
  )
  return true
}
