import type { CommonPowerSyncDatabase } from '@powersync/common'
import {
  PowerSyncTransactor,
  powerSyncCollectionOptions,
} from '@tanstack/powersync-db-collection'
import { createCollection, createTransaction } from '@tanstack/react-db'
import {
  appSchema,
  bodySchema,
  entrySchema,
  entryTextSchema,
  itemSchema,
  type NewItem,
  newItemSchema,
  titleSchema,
} from './schema'

/**
 * Collections and write operations over one PowerSync database. Writes apply optimistically and
 * resolve once they are stored in local SQLite, from where PowerSync will upload them.
 */
export function createStore(database: CommonPowerSyncDatabase) {
  const onDeserializationError = (error: unknown) =>
    console.error('Skipped a row that does not match the schema', error)

  const items = createCollection(
    powerSyncCollectionOptions({
      id: 'items',
      database,
      table: appSchema.props.items,
      schema: itemSchema,
      onDeserializationError,
    }),
  )

  const entries = createCollection(
    powerSyncCollectionOptions({
      id: 'entries',
      database,
      table: appSchema.props.entries,
      schema: entrySchema,
      onDeserializationError,
    }),
  )

  const now = () => new Date().toISOString()
  const transactor = new PowerSyncTransactor({ database })

  /** Applies mutations across collections in one SQLite transaction: all are stored or none. */
  async function inTransaction(mutate: () => void) {
    const transaction = createTransaction({
      mutationFn: ({ transaction }) => transactor.applyTransaction(transaction),
    })
    transaction.mutate(mutate)
    await transaction.isPersisted.promise
  }

  return {
    items,
    entries,

    /** Creates an item, and for a list its entries, in one transaction. */
    async createItem(input: NewItem) {
      const { type, title, body, entries: texts } = newItemSchema.parse(input)
      const id = crypto.randomUUID()
      const timestamp = now()
      await inTransaction(() => {
        items.insert({
          id,
          type,
          title,
          body,
          completed_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        })
        if (texts.length > 0) {
          entries.insert(
            texts.map((text) => ({
              id: crypto.randomUUID(),
              item_id: id,
              text,
              completed_at: null,
              created_at: timestamp,
              updated_at: timestamp,
            })),
          )
        }
      })
      return id
    },

    async updateItem(id: string, changes: { title?: string; body?: string }) {
      const title =
        changes.title === undefined
          ? undefined
          : titleSchema.parse(changes.title)
      const body =
        changes.body === undefined ? undefined : bodySchema.parse(changes.body)
      await items.update(id, (draft) => {
        if (title !== undefined) draft.title = title
        if (body !== undefined) draft.body = body
        draft.updated_at = now()
      }).isPersisted.promise
    },

    async setItemCompleted(id: string, completed: boolean) {
      const timestamp = now()
      await items.update(id, (draft) => {
        draft.completed_at = completed ? timestamp : null
        draft.updated_at = timestamp
      }).isPersisted.promise
    },

    /** Deletes the item and its entries in one SQLite transaction, so no entry is left orphaned. */
    async deleteItem(id: string) {
      await entries.preload()
      const entryIds = entries.toArray
        .filter((entry) => entry.item_id === id)
        .map((entry) => entry.id)
      await inTransaction(() => {
        if (entryIds.length > 0) entries.delete(entryIds)
        items.delete(id)
      })
    },

    async addEntry(itemId: string, text: string) {
      const id = crypto.randomUUID()
      const timestamp = now()
      await entries.insert({
        id,
        item_id: itemId,
        text: entryTextSchema.parse(text),
        completed_at: null,
        created_at: timestamp,
        updated_at: timestamp,
      }).isPersisted.promise
      return id
    },

    async updateEntryText(id: string, text: string) {
      const parsed = entryTextSchema.parse(text)
      await entries.update(id, (draft) => {
        draft.text = parsed
        draft.updated_at = now()
      }).isPersisted.promise
    },

    async setEntryCompleted(id: string, completed: boolean) {
      const timestamp = now()
      await entries.update(id, (draft) => {
        draft.completed_at = completed ? timestamp : null
        draft.updated_at = timestamp
      }).isPersisted.promise
    },

    async deleteEntry(id: string) {
      await entries.delete(id).isPersisted.promise
    },
  }
}

export type Store = ReturnType<typeof createStore>
