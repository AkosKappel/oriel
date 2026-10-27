import { column, Schema, Table } from '@powersync/common'
import { z } from 'zod'

// PowerSync adds the text `id` column itself. Timestamps are ISO 8601 strings, and completion is
// stored as a timestamp so it records when something was done, not only whether.

const items = new Table(
  {
    type: column.text,
    title: column.text,
    body: column.text,
    completed_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { created: ['created_at'] } },
)

const entries = new Table(
  {
    item_id: column.text,
    text: column.text,
    completed_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { item: ['item_id'] } },
)

export const appSchema = new Schema({ items, entries })

export const itemTypes = ['note', 'list', 'task'] as const

export type ItemType = (typeof itemTypes)[number]

export const itemSchema = z.object({
  id: z.string(),
  type: z.enum(itemTypes),
  title: z.string(),
  body: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Item = z.infer<typeof itemSchema>

export const entrySchema = z.object({
  id: z.string(),
  item_id: z.string(),
  text: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type Entry = z.infer<typeof entrySchema>

export const titleSchema = z
  .string()
  .trim()
  .min(1, 'Add a title')
  .max(200, 'Keep the title under 200 characters')
export const bodySchema = z.string().trim().max(20_000)
export const entryTextSchema = z
  .string()
  .trim()
  .min(1, 'Add some text')
  .max(500)

export const newItemSchema = z
  .object({
    type: z.enum(itemTypes),
    title: titleSchema,
    body: bodySchema.default(''),
    entries: z.array(entryTextSchema).max(500).default([]),
  })
  .refine((item) => item.type === 'list' || item.entries.length === 0, {
    message: 'Only lists have entries',
    path: ['entries'],
  })

export type NewItem = z.input<typeof newItemSchema>
