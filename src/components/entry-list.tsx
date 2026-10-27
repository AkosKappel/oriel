import { eq, useLiveQuery } from '@tanstack/react-db'
import { Plus, X } from 'lucide-react'
import { type ClipboardEvent, type FormEvent, useState } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { Checkbox } from '#/components/ui/checkbox'
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
    <section aria-label="Items" className="flex flex-col">
      <div className="flex min-h-9 items-center justify-between text-xs text-muted-foreground">
        <p aria-live="polite">
          {total === 0
            ? 'No items yet'
            : open === 0
              ? 'All done'
              : `${open} of ${total} left`}
        </p>
        {checked > 0 && (
          <Button
            onPress={() => void clearChecked()}
            className="-mr-2 rounded-sm px-2 py-2 hover:text-foreground data-focus-visible:outline-2"
          >
            Clear checked
          </Button>
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
    <li className="group relative flex items-center">
      <Checkbox
        className="absolute -left-[2.375rem]"
        isSelected={done}
        onChange={(selected) =>
          void store.setEntryCompleted(entry.id, selected)
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
          'h-11 min-w-0 flex-1 bg-transparent font-serif text-lg outline-none',
          done && 'text-muted-foreground line-through decoration-1',
        )}
      />
      {/* Quiet until hovered on desktop; always there on touch, where hover does not exist. */}
      <Button
        onPress={() => void remove()}
        aria-label={`Remove ${entry.text}`}
        className="-mr-3 grid size-11 shrink-0 place-items-center rounded-sm text-faint hover:text-foreground data-focus-visible:outline-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:data-focus-visible:opacity-100"
      >
        <X aria-hidden className="size-4" />
      </Button>
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
    <form onSubmit={submit} className="relative flex items-center">
      <span className="absolute -left-[2.375rem] grid size-11 place-items-center text-faint">
        <Plus aria-hidden className="size-4" />
      </span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onPaste={paste}
        placeholder="Add an item"
        aria-label="Add an item"
        maxLength={500}
        enterKeyHint="enter"
        className="h-11 min-w-0 flex-1 bg-transparent font-serif text-lg outline-none placeholder:text-faint"
      />
    </form>
  )
}
