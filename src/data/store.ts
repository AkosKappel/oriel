import type { CommonPowerSyncDatabase } from '@powersync/common'
import {
  PowerSyncTransactor,
  powerSyncCollectionOptions,
} from '@tanstack/powersync-db-collection'
import { createCollection, createTransaction } from '@tanstack/react-db'
import {
  appSchema,
  bodySchema,
  type Entry,
  entrySchema,
  entryTextSchema,
  type Item,
  itemSchema,
  type NewItem,
  newItemSchema,
  type Priority,
  prioritySchema,
  titleSchema,
} from './schema'

export type Snapshot = { items: Item[]; entries: Entry[] }

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

  function newEntries(itemId: string, texts: string[], timestamp: string) {
    // Milliseconds as positions keep entries in the order they were added, also across devices.
    const base = Date.now()
    return texts.map((text, index) => ({
      id: crypto.randomUUID(),
      item_id: itemId,
      text,
      completed_at: null,
      position: base + index,
      created_at: timestamp,
      updated_at: timestamp,
    }))
  }

  const transactor = new PowerSyncTransactor({ database })

  /** Applies mutations across collections in one SQLite transaction: all are stored or none. */
  async function inTransaction(mutate: () => void) {
    const transaction = createTransaction({
      mutationFn: ({ transaction }) => transactor.applyTransaction(transaction),
    })
    transaction.mutate(mutate)
    await transaction.isPersisted.promise
  }

  /** Adds entries to the end of a list in one transaction, in the given order. */
  async function addEntries(itemId: string, texts: string[]) {
    const parsed = texts.map((text) => entryTextSchema.parse(text))
    const rows = newEntries(itemId, parsed, now())
    await inTransaction(() => {
      entries.insert(rows)
    })
    return rows.map((row) => row.id)
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
          pinned_at: null,
          priority: 0,
          created_at: timestamp,
          updated_at: timestamp,
        })
        if (texts.length > 0) {
          entries.insert(newEntries(id, texts, timestamp))
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

    async setItemPinned(id: string, pinned: boolean) {
      const timestamp = now()
      await items.update(id, (draft) => {
        draft.pinned_at = pinned ? timestamp : null
        draft.updated_at = timestamp
      }).isPersisted.promise
    },

    async setItemPriority(id: string, priority: Priority) {
      const parsed = prioritySchema.parse(priority)
      await items.update(id, (draft) => {
        draft.priority = parsed
        draft.updated_at = now()
      }).isPersisted.promise
    },

    /**
     * Deletes the item and its entries in one SQLite transaction, so no entry is left orphaned.
     * Returns what was deleted, for `restore`.
     */
    async deleteItem(id: string): Promise<Snapshot> {
      await Promise.all([items.preload(), entries.preload()])
      const item = items.get(id)
      if (!item) return { items: [], entries: [] }
      const removed = entries.toArray.filter((entry) => entry.item_id === id)
      await inTransaction(() => {
        if (removed.length > 0) entries.delete(removed.map((entry) => entry.id))
        items.delete(id)
      })
      return { items: [item], entries: removed }
    },

    /** Puts deleted rows back with their original ids, for Undo. */
    async restore(snapshot: Snapshot) {
      if (snapshot.items.length === 0 && snapshot.entries.length === 0) return
      await inTransaction(() => {
        if (snapshot.items.length > 0) items.insert(snapshot.items)
        if (snapshot.entries.length > 0) entries.insert(snapshot.entries)
      })
    },

    async addEntry(itemId: string, text: string) {
      const [id] = await addEntries(itemId, [text])
      return id
    },

    addEntries,

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

    /** Removes the checked entries of a list. Returns them, for `restore`. */
    async clearCompletedEntries(itemId: string): Promise<Snapshot> {
      await entries.preload()
      const removed = entries.toArray.filter(
        (entry) => entry.item_id === itemId && entry.completed_at !== null,
      )
      if (removed.length > 0) {
        await inTransaction(() => {
          entries.delete(removed.map((entry) => entry.id))
        })
      }
      return { items: [], entries: removed }
    },
  }
}

export type Store = ReturnType<typeof createStore>
