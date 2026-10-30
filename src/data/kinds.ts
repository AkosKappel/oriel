// Plain lists of what items can be, apart from schema.ts so route definitions can read them
// without loading Zod and PowerSync on every page.

export const itemTypes = ['note', 'list', 'task'] as const

export const taskStatuses = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
] as const
