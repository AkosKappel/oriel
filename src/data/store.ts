import type { CommonPowerSyncDatabase, Transaction } from '@powersync/common'
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
  memberSchema,
  type NewItem,
  newItemSchema,
  type Owner,
  type Priority,
  prioritySchema,
  spaceSchema,
  titleSchema,
} from './schema'

export type Snapshot = { items: Item[]; entries: Entry[] }

type Row = Record<string, string | number | null>

/** Deletes a row and inserts it again with the given values; see `claimLocalData`. */
async function reinsert(tx: Transaction, table: 'items' | 'entries', row: Row) {
  // Column names come from our own rows, never from user input.
  const columns = Object.keys(row)
  await tx.execute(`DELETE FROM ${table} WHERE id = ?`, [row.id])
  await tx.execute(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  )
}

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

  // Read-only on the device: filled by sync, changed through the sharing server functions.
  const spaces = createCollection(
    powerSyncCollectionOptions({
      id: 'spaces',
      database,
      table: appSchema.props.space,
      schema: spaceSchema,
      onDeserializationError,
    }),
  )

  const members = createCollection(
    powerSyncCollectionOptions({
      id: 'members',
      database,
      table: appSchema.props.space_member,
      schema: memberSchema,
      onDeserializationError,
    }),
  )

  const now = () => new Date().toISOString()
  let owner: Owner | null = null

  function newEntries(
    itemId: string,
    spaceId: string | null,
    texts: string[],
    timestamp: string,
  ) {
    // Milliseconds as positions keep entries in the order they were added, also across devices.
    const base = Date.now()
    return texts.map((text, index) => ({
      id: crypto.randomUUID(),
      item_id: itemId,
      space_id: spaceId,
      text,
      completed_at: null,
      completed_by: null,
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
    // Entries live in their list's space, which may be shared and differ from the owner's.
    await items.preload()
    const spaceId = items.get(itemId)?.space_id ?? owner?.spaceId ?? null
    const rows = newEntries(itemId, spaceId, parsed, now())
    await inTransaction(() => {
      entries.insert(rows)
    })
    return rows.map((row) => row.id)
  }

  return {
    items,
    entries,
    spaces,
    members,

    /** Sets who new items belong to: the signed-in user's personal space, or nobody. */
    setOwner(next: Owner | null) {
      owner = next
    },

    /**
     * Moves everything created without an account into the owner's space, in one transaction, so
     * signing up keeps all local data. Rows that already belong to a space are left alone.
     * Returns how many items were claimed.
     *
     * Each row is deleted and inserted again rather than updated: the upload queue then carries
     * the whole row with its space (a DELETE and a PUT). An update would upload as a PATCH of a
     * row the server never received, which it cannot create from a few columns.
     */
    async claimLocalData(claimant: Owner) {
      const claimed = await database.writeTransaction(async (tx) => {
        const unclaimedItems = await tx.getAll<Row>(
          'SELECT * FROM items WHERE space_id IS NULL',
        )
        for (const row of unclaimedItems) {
          await reinsert(tx, 'items', {
            ...row,
            space_id: claimant.spaceId,
            created_by: claimant.userId,
          })
        }
        const unclaimedEntries = await tx.getAll<Row>(
          `SELECT entries.*, items.space_id AS list_space_id
           FROM entries LEFT JOIN items ON items.id = entries.item_id
           WHERE entries.space_id IS NULL`,
        )
        for (const { list_space_id, ...row } of unclaimedEntries) {
          await reinsert(tx, 'entries', {
            ...row,
            space_id: list_space_id ?? claimant.spaceId,
          })
        }
        return unclaimedItems.length
      })
      return claimed
    },

    /**
     * Moves an item and its entries to another space, re-inserted for the same reason as in
     * `claimLocalData`: the server checks the move as a delete in one space and a create in the
     * other, and needs edit rights in both.
     */
    async moveItem(itemId: string, spaceId: string) {
      await database.writeTransaction(async (tx) => {
        const [item] = await tx.getAll<Row>(
          'SELECT * FROM items WHERE id = ?',
          [itemId],
        )
        if (!item || item.space_id === spaceId) return
        const itemEntries = await tx.getAll<Row>(
          'SELECT * FROM entries WHERE item_id = ?',
          [itemId],
        )
        await reinsert(tx, 'items', { ...item, space_id: spaceId })
        for (const entry of itemEntries) {
          await reinsert(tx, 'entries', { ...entry, space_id: spaceId })
        }
      })
    },

    /** Creates an item, and for a list its entries, in one transaction. */
    async createItem(input: NewItem, options: { spaceId?: string } = {}) {
      const { type, title, body, entries: texts } = newItemSchema.parse(input)
      // A shared space when capturing into one, otherwise the owner's personal space.
      const spaceId = options.spaceId ?? owner?.spaceId ?? null
      const id = crypto.randomUUID()
      const timestamp = now()
      await inTransaction(() => {
        items.insert({
          id,
          space_id: spaceId,
          created_by: owner?.userId ?? null,
          type,
          title,
          body,
          completed_at: null,
          completed_by: null,
          pinned_at: null,
          priority: 0,
          created_at: timestamp,
          updated_at: timestamp,
        })
        if (texts.length > 0) {
          entries.insert(newEntries(id, spaceId, texts, timestamp))
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
        draft.completed_by = completed ? (owner?.userId ?? null) : null
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
        draft.completed_by = completed ? (owner?.userId ?? null) : null
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

    /**
     * Unchecks every entry of a list, to use it again (a weekly shopping list). Returns the
     * entries as they were, for `restoreChecks`.
     */
    async uncheckAllEntries(itemId: string): Promise<Entry[]> {
      await entries.preload()
      const checked = entries.toArray.filter(
        (entry) => entry.item_id === itemId && entry.completed_at !== null,
      )
      if (checked.length > 0) {
        const timestamp = now()
        await inTransaction(() => {
          entries.update(
            checked.map((entry) => entry.id),
            (drafts) => {
              for (const draft of drafts) {
                draft.completed_at = null
                draft.completed_by = null
                draft.updated_at = timestamp
              }
            },
          )
        })
      }
      return checked
    },

    /** Puts back who checked what and when, for Undo after `uncheckAllEntries`. */
    async restoreChecks(previous: Entry[]) {
      const present = previous.filter((entry) => entries.has(entry.id))
      if (present.length === 0) return
      const byId = new Map(present.map((entry) => [entry.id, entry]))
      await inTransaction(() => {
        entries.update(
          present.map((entry) => entry.id),
          (drafts) => {
            for (const draft of drafts) {
              const before = byId.get(draft.id)
              draft.completed_at = before?.completed_at ?? null
              draft.completed_by = before?.completed_by ?? null
              draft.updated_at = now()
            }
          },
        )
      })
    },
  }
}

export type Store = ReturnType<typeof createStore>
