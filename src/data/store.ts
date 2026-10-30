import type { CommonPowerSyncDatabase, Transaction } from '@powersync/common'
import {
  PowerSyncTransactor,
  powerSyncCollectionOptions,
} from '@tanstack/powersync-db-collection'
import { createCollection, createTransaction } from '@tanstack/react-db'
import { localDay, nextDue } from '#/lib/dates'
import { readEntryLine } from './capture'
import type { ImportedItem } from './export'
import { sortEntries } from './organize'
import {
  appSchema,
  bodySchema,
  dueSchema,
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
  type Repeat,
  repeatSchema,
  spaceSchema,
  statusSchema,
  type TaskStatus,
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
  // A row the schema refuses stops the whole batch from loading, so the row schemas read leniently.
  const onDeserializationError = (error: unknown) =>
    console.error('A row does not match the schema', error)

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
  ): Entry[] {
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

  // The screen updates before SQLite has stored a write; a reload in between loses it, so the
  // page asks before unloading while this is above zero.
  let pendingWrites = 0
  async function saved(transaction: {
    isPersisted: { promise: Promise<unknown> }
  }) {
    pendingWrites++
    try {
      await transaction.isPersisted.promise
    } finally {
      pendingWrites--
    }
  }

  /** Applies mutations across collections in one SQLite transaction: all are stored or none. */
  async function inTransaction(mutate: () => void) {
    const transaction = createTransaction({
      mutationFn: ({ transaction }) => transactor.applyTransaction(transaction),
    })
    transaction.mutate(mutate)
    await saved(transaction)
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

  const store = {
    items,
    entries,
    spaces,
    members,

    /** Whether a write is shown on screen but not yet stored in SQLite. */
    hasPendingWrites: () => pendingWrites > 0,

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
      await members.preload()
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
        // A task stays for its assignee only if they are in the new space too.
        const assigneeStays = members.toArray.some(
          (member) =>
            member.space_id === spaceId && member.user_id === item.assigned_to,
        )
        await reinsert(tx, 'items', {
          ...item,
          space_id: spaceId,
          assigned_to: assigneeStays ? item.assigned_to : null,
        })
        for (const entry of itemEntries) {
          await reinsert(tx, 'entries', { ...entry, space_id: spaceId })
        }
      })
    },

    /**
     * Turns a note into a list (each line an entry, "[x]" lines checked) or a list into a note
     * (entries as Markdown checkbox lines under its text). Returns the item and entries as they
     * were, for `undoConversion`.
     */
    async convertItem(id: string, type: 'note' | 'list'): Promise<Snapshot> {
      await Promise.all([items.preload(), entries.preload()])
      const item = items.get(id)
      if (!item || item.type === type || item.type === 'task') {
        return { items: [], entries: [] }
      }
      const before = entries.toArray.filter((entry) => entry.item_id === id)
      const timestamp = now()

      if (type === 'list') {
        const lines = item.body
          .split(/\r?\n/)
          .map(readEntryLine)
          .filter((line) => line.text)
        const rows = newEntries(
          id,
          item.space_id,
          lines.map((line) => entryTextSchema.parse(line.text.slice(0, 500))),
          timestamp,
        ).map((row, index) =>
          lines[index].checked
            ? {
                ...row,
                completed_at: timestamp,
                completed_by: owner?.userId ?? null,
              }
            : row,
        )
        await inTransaction(() => {
          items.update(id, (draft) => {
            draft.type = 'list'
            draft.body = ''
            draft.updated_at = timestamp
          })
          if (rows.length > 0) entries.insert(rows)
        })
      } else {
        const lines = sortEntries(before).map(
          (entry) => `- [${entry.completed_at ? 'x' : ' '}] ${entry.text}`,
        )
        const body = bodySchema.parse(
          [item.body, lines.join('\n')].filter(Boolean).join('\n\n'),
        )
        await inTransaction(() => {
          items.update(id, (draft) => {
            draft.type = 'note'
            draft.body = body
            draft.updated_at = timestamp
          })
          if (before.length > 0) entries.delete(before.map((entry) => entry.id))
        })
      }
      return { items: [item], entries: before }
    },

    /** Puts an item back the way `convertItem` found it, with its original entries. */
    async undoConversion(snapshot: Snapshot) {
      const [previous] = snapshot.items
      if (!previous || !items.has(previous.id)) return
      await entries.preload()
      const current = entries.toArray.filter(
        (entry) => entry.item_id === previous.id,
      )
      await inTransaction(() => {
        items.update(previous.id, (draft) => {
          draft.type = previous.type
          draft.body = previous.body
          draft.updated_at = now()
        })
        if (current.length > 0) entries.delete(current.map((entry) => entry.id))
        if (snapshot.entries.length > 0) entries.insert(snapshot.entries)
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
          status: null,
          due_on: null,
          repeat: null,
          snoozed_until: null,
          assigned_to: null,
          archived_at: null,
          deleted_at: null,
          deleted_by: null,
          created_at: timestamp,
          updated_at: timestamp,
        })
        if (texts.length > 0) {
          entries.insert(newEntries(id, spaceId, texts, timestamp))
        }
      })
      return id
    },

    /**
     * A fresh copy in the same space: title (marked as a copy), text and list entries in their
     * order, all unchecked, so a packing or shopping list can be reused as a template.
     */
    async duplicateItem(id: string) {
      const source = items.get(id)
      if (!source) throw new Error('No such item')
      const texts = entries.toArray
        .filter((entry) => entry.item_id === id)
        .sort((a, b) => a.position - b.position)
        .map((entry) => entry.text)
      return store.createItem(
        {
          type: source.type,
          title: `${source.title.slice(0, 193)} (copy)`,
          body: source.body,
          entries: texts,
        },
        { spaceId: source.space_id ?? undefined },
      )
    },

    async updateItem(id: string, changes: { title?: string; body?: string }) {
      const title =
        changes.title === undefined
          ? undefined
          : titleSchema.parse(changes.title)
      const body =
        changes.body === undefined ? undefined : bodySchema.parse(changes.body)
      await saved(
        items.update(id, (draft) => {
          if (title !== undefined) draft.title = title
          if (body !== undefined) draft.body = body
          draft.updated_at = now()
        }),
      )
    },

    /**
     * Finishes or reopens a task. A repeating task stays open with its due day moved on instead;
     * the new day is returned, and undone with `setItemDue`.
     */
    async setItemCompleted(
      id: string,
      completed: boolean,
    ): Promise<string | undefined> {
      const timestamp = now()
      const repeat = items.get(id)?.repeat
      if (completed && repeat) {
        const next = nextDue(
          items.get(id)?.due_on ?? null,
          repeat,
          localDay(new Date()),
        )
        await saved(
          items.update(id, (draft) => {
            draft.due_on = next
            draft.updated_at = timestamp
          }),
        )
        return next
      }
      await saved(
        items.update(id, (draft) => {
          draft.completed_at = completed ? timestamp : null
          draft.completed_by = completed ? (owner?.userId ?? null) : null
          draft.updated_at = timestamp
        }),
      )
    },

    async setItemPinned(id: string, pinned: boolean) {
      const timestamp = now()
      await saved(
        items.update(id, (draft) => {
          draft.pinned_at = pinned ? timestamp : null
          draft.updated_at = timestamp
        }),
      )
    },

    async setItemPriority(id: string, priority: Priority) {
      const parsed = prioritySchema.parse(priority)
      await saved(
        items.update(id, (draft) => {
          draft.priority = parsed
          draft.updated_at = now()
        }),
      )
    },

    async setItemStatus(id: string, status: TaskStatus | null) {
      const parsed = statusSchema.parse(status)
      await saved(
        items.update(id, (draft) => {
          draft.status = parsed
          draft.updated_at = now()
        }),
      )
    },

    async setItemDue(id: string, due: string | null) {
      const parsed = dueSchema.parse(due)
      await saved(
        items.update(id, (draft) => {
          draft.due_on = parsed
          draft.updated_at = now()
        }),
      )
    },

    /** Puts an item off home until a day, or brings it back with null. */
    async setItemSnoozed(id: string, until: string | null) {
      const parsed = dueSchema.parse(until)
      await saved(
        items.update(id, (draft) => {
          draft.snoozed_until = parsed
          draft.updated_at = now()
        }),
      )
    },

    /** Gives a task to a member of its space, or to nobody in particular with null. */
    async setItemAssignee(id: string, userId: string | null) {
      await saved(
        items.update(id, (draft) => {
          draft.assigned_to = userId
          draft.updated_at = now()
        }),
      )
    },

    async setItemRepeat(id: string, repeat: Repeat | null) {
      const parsed = repeatSchema.parse(repeat)
      await saved(
        items.update(id, (draft) => {
          draft.repeat = parsed
          draft.updated_at = now()
        }),
      )
    },

    async setItemArchived(id: string, archived: boolean) {
      const timestamp = now()
      await saved(
        items.update(id, (draft) => {
          draft.archived_at = archived ? timestamp : null
          draft.updated_at = timestamp
        }),
      )
    },

    /** Moves an item to the trash, on every device; its entries stay with it. */
    async trashItem(id: string) {
      const timestamp = now()
      await saved(
        items.update(id, (draft) => {
          draft.deleted_at = timestamp
          draft.deleted_by = owner?.userId ?? null
          draft.updated_at = timestamp
        }),
      )
    },

    /** Takes an item out of the trash, for Undo and the trash view. */
    async restoreItem(id: string) {
      await saved(
        items.update(id, (draft) => {
          draft.deleted_at = null
          draft.deleted_by = null
          draft.updated_at = now()
        }),
      )
    },

    /**
     * Deletes for good what went to the trash before `cutoff` (ISO time), with entries. Returns
     * what was deleted, for `restore`. Only items this device may delete: its own, or in a space where the
     * owner edits; the server refuses the rest anyway, and some editor's device will do them.
     */
    async deleteTrashedBefore(cutoff: string): Promise<Snapshot> {
      await Promise.all([items.preload(), entries.preload(), members.preload()])
      const editable = new Set(
        members.toArray
          .filter(
            (member) =>
              member.user_id === owner?.userId && member.role !== 'viewer',
          )
          .map((member) => member.space_id),
      )
      const doomed = items.toArray.filter(
        (item) =>
          item.deleted_at !== null &&
          item.deleted_at <= cutoff &&
          (item.space_id === null || editable.has(item.space_id)),
      )
      const ids = new Set(doomed.map((item) => item.id))
      const doomedEntries = entries.toArray.filter((entry) =>
        ids.has(entry.item_id),
      )
      if (doomed.length > 0) {
        await inTransaction(() => {
          if (doomedEntries.length > 0) {
            entries.delete(doomedEntries.map((entry) => entry.id))
          }
          items.delete([...ids])
        })
      }
      return { items: doomed, entries: doomedEntries }
    },

    /**
     * Deletes the item and its entries for good, in one SQLite transaction, so no entry is left
     * orphaned. Returns what was deleted, for `restore`.
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

    /**
     * Adds items from an export to the owner's space (or this device without an account), with
     * new ids: ids from another account would clash with rows the server already has. Items that
     * are already here (same type, title and creation time) and trashed ones are skipped, so
     * importing the same file twice changes nothing. One transaction: all or nothing.
     */
    async importItems(imported: ImportedItem[]) {
      await items.preload()
      const key = (item: Pick<Item, 'type' | 'title' | 'created_at'>) =>
        `${item.type}\n${item.title}\n${item.created_at}`
      const present = new Set(items.toArray.map(key))
      const spaceId = owner?.spaceId ?? null
      const newItems: Item[] = []
      const newEntries: Entry[] = []

      for (const item of imported) {
        const title = titleSchema.safeParse(item.title)
        const body = bodySchema.safeParse(item.body)
        if (item.deleted_at || !title.success || !body.success) continue
        if (present.has(key(item))) continue
        present.add(key(item))
        const id = crypto.randomUUID()
        const { entries: itemEntries, ...fields } = item
        newItems.push({
          ...fields,
          id,
          space_id: spaceId,
          created_by: owner?.userId ?? null,
          title: title.data,
          body: body.data,
          completed_by: null,
          deleted_at: null,
          deleted_by: null,
        })
        for (const entry of itemEntries) {
          const text = entryTextSchema.safeParse(entry.text)
          if (!text.success) continue
          newEntries.push({
            ...entry,
            id: crypto.randomUUID(),
            item_id: id,
            space_id: spaceId,
            text: text.data,
            completed_by: null,
          })
        }
      }

      if (newItems.length > 0) {
        await inTransaction(() => {
          items.insert(newItems)
          if (newEntries.length > 0) entries.insert(newEntries)
        })
      }
      return {
        added: newItems.length,
        skipped: imported.length - newItems.length,
      }
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
      await saved(
        entries.update(id, (draft) => {
          draft.text = parsed
          draft.updated_at = now()
        }),
      )
    },

    async setEntryPosition(id: string, position: number) {
      await saved(
        entries.update(id, (draft) => {
          draft.position = position
          draft.updated_at = now()
        }),
      )
    },

    async setEntryCompleted(id: string, completed: boolean) {
      const timestamp = now()
      await saved(
        entries.update(id, (draft) => {
          draft.completed_at = completed ? timestamp : null
          draft.completed_by = completed ? (owner?.userId ?? null) : null
          draft.updated_at = timestamp
        }),
      )
    },

    async deleteEntry(id: string) {
      await saved(entries.delete(id))
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
  return store
}

export type Store = ReturnType<typeof createStore>
