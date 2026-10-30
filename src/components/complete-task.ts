import { toast } from 'sonner'
import type { Item } from '#/data/schema'
import type { Store } from '#/data/store'
import { describeDue, localDay } from '#/lib/dates'

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
  // "Due 6 November" reads "next due 6 November".
  const due = describeDue(next, localDay(new Date()))
  toast(`${item.title}: next ${due[0].toLowerCase()}${due.slice(1)}`, {
    action: {
      label: 'Undo',
      onClick: () => void store.setItemDue(item.id, item.due_on),
    },
  })
  return true
}
