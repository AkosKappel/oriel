import { CircleCheck, ListChecks, StickyNote } from 'lucide-react'
import type { ItemType } from '#/data/schema'

export const itemIcons = {
  note: StickyNote,
  list: ListChecks,
  task: CircleCheck,
} satisfies Record<ItemType, unknown>

export const itemLabels: Record<ItemType, string> = {
  note: 'Note',
  list: 'List',
  task: 'Task',
}
