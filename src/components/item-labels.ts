import type { ItemType, Priority, Repeat, TaskStatus } from '#/data/schema'
import { m } from '#/paraglide/messages.js'

// Labels are looked up when shown, never kept in module constants: the server renders pages in
// each request's language.

/** "Note", "List", "Task" */
export const itemLabel = (type: ItemType) => m.type_label({ type })

/** "Notes", "Lists", "Tasks" */
export const itemsLabel = (type: ItemType) => m.type_plural({ type })

/** "None" to "High" */
export const priorityLabel = (priority: Priority) =>
  m.priority_label({ priority: String(priority) })

/** "High priority", for a row's detail line */
export const priorityDetail = (priority: Priority) =>
  m.priority_detail({ priority: String(priority) })

/** "To do" for null, then "In progress", "Waiting" */
export const statusLabel = (status: TaskStatus | null) =>
  m.status_label({ status: status ?? 'to_do' })

/** "Never" for null, then "Daily", "Weekly", "Monthly" */
export const repeatLabel = (repeat: Repeat | null) =>
  m.repeat_label({ repeat: repeat ?? 'never' })

/** "Repeats weekly", for a row's detail line */
export const repeatDetail = (repeat: Repeat) => m.repeat_detail({ repeat })
