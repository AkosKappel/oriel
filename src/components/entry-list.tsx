import { eq, useLiveQuery } from '@tanstack/react-db'
import { Plus, X } from 'lucide-react'
import { type ClipboardEvent, type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '#/components/checkbox'
import { stripBullet } from '#/data/capture'
import { countEntries, sortEntries } from '#/data/organize'
import { type Entry, entryTextSchema } from '#/data/schema'
import type { Store } from '#/data/store'
import { cn } from '#/lib/utils'

export function EntryList({ store, itemId }: { store: Store; itemId: string }) {
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ entry: store.entries })
        .where(({ entry }) => eq(entry.item_id, itemId)),
  })
  const entries = sortEntries(data)
  const { total = 0, open = 0 } = countEntries(entries).get(itemId) ?? {}
  const checked = total - open

  async function clearChecked() {
    const snapshot = await store.clearCompletedEntries(itemId)
    toast(`Cleared ${snapshot.entries.length} checked`, {
      action: { label: 'Undo', onClick: () => void store.restore(snapshot) },
    })
  }

  return (
    <section aria-label="Items" className="flex flex-col gap-1">
      <div className="flex min-h-9 items-center justify-between text-sm text-muted-foreground">
        <p aria-live="polite">
          {total === 0
            ? 'No items yet'
            : open === 0
              ? 'All done'
              : `${open} of ${total} left`}
        </p>
        {checked > 0 && (
          <button
            type="button"
            onClick={() => void clearChecked()}
            className="rounded-md px-2 py-1.5 hover:bg-secondary hover:text-foreground"
          >
            Clear checked
          </button>
        )}
      </div>
      <ul>
        {entries.map((entry) => (
          <EntryRow
            key={`${entry.id}:${entry.text}`}
            store={store}
            entry={entry}
          />
        ))}
      </ul>
      <AddEntry store={store} itemId={itemId} />
    </section>
  )
}

function EntryRow({ store, entry }: { store: Store; entry: Entry }) {
  const done = entry.completed_at !== null

  async function remove() {
    await store.deleteEntry(entry.id)
    toast(`Removed ${entry.text}`, {
      action: {
        label: 'Undo',
        onClick: () => void store.restore({ items: [], entries: [entry] }),
      },
    })
  }

  function saveText(value: string) {
    if (value.trim() === entry.text) return
    if (!entryTextSchema.safeParse(value).success) {
      // Emptying an entry is the quickest way to remove it on a phone.
      if (value.trim() === '') void remove()
      return
    }
    void store.updateEntryText(entry.id, value)
  }

  return (
    <li className="group flex items-center gap-1">
      <Checkbox
        checked={done}
        onChange={(event) =>
          void store.setEntryCompleted(entry.id, event.target.checked)
        }
        aria-label={`Check ${entry.text}`}
      />
      <input
        defaultValue={entry.text}
        aria-label="Item text"
        maxLength={500}
        enterKeyHint="done"
        onBlur={(event) => saveText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            event.currentTarget.value = entry.text
            event.currentTarget.blur()
          }
        }}
        className={cn(
          'h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 focus:bg-card',
          done && 'text-muted-foreground line-through',
        )}
      />
      <button
        type="button"
        onClick={() => void remove()}
        aria-label={`Remove ${entry.text}`}
        className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
    </li>
  )
}

function AddEntry({ store, itemId }: { store: Store; itemId: string }) {
  const [text, setText] = useState('')

  function add(value: string) {
    const lines = value
      .split(/\r?\n/)
      .map((line) => stripBullet(line.trim()))
      .filter((line) => entryTextSchema.safeParse(line).success)
    if (lines.length === 0) return false
    void store.addEntries(itemId, lines)
    return true
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (add(text)) setText('')
  }

  // A text input drops line breaks, so a pasted list is split here: one entry per line.
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text')
    if (!pasted.includes('\n')) return
    event.preventDefault()
    add(pasted)
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <span className="grid size-11 shrink-0 place-items-center text-muted-foreground">
        <Plus aria-hidden className="size-5" />
      </span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onPaste={paste}
        placeholder="Add an item"
        aria-label="Add an item"
        maxLength={500}
        enterKeyHint="enter"
        className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 placeholder:text-muted-foreground focus:bg-card"
      />
    </form>
  )
}
