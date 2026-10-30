import { eq, useLiveQuery } from '@tanstack/react-db'
import { GripVertical, Plus, X } from 'lucide-react'
import {
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { ScanButton } from '#/components/scan-button'
import { Checkbox } from '#/components/ui/checkbox'
import { stripBullet } from '#/data/capture'
import {
  countEntries,
  positionForMove,
  sortEntries,
  suggestEntries,
} from '#/data/organize'
import { type Entry, entryTextSchema } from '#/data/schema'
import type { Store } from '#/data/store'
import { useRows } from '#/lib/use-rows'
import { cn } from '#/lib/utils'

const listAction =
  'rounded-sm px-2 py-2 hover:text-foreground data-focus-visible:outline-2'

export function EntryList({
  store,
  itemId,
  readOnly = false,
  checkedBy = () => undefined,
}: {
  store: Store
  itemId: string
  readOnly?: boolean
  /** The name to show beside an entry someone else checked. */
  checkedBy?: (userId: string | null) => string | undefined
}) {
  const { data, isReady } = useLiveQuery({
    query: (q) =>
      q
        .from({ entry: store.entries })
        .where(({ entry }) => eq(entry.item_id, itemId)),
  })
  const entries = sortEntries(data)
  const { total = 0, open = 0 } = countEntries(entries).get(itemId) ?? {}
  const checked = total - open
  // Only open entries can be moved; checked ones keep the order they were checked in.
  const openEntries = entries.filter((entry) => !entry.completed_at)
  const [announcement, setAnnouncement] = useState('')

  // Entries there when the list first loaded; any other entry was just added, here or by another
  // member, and slides in. Opening a list therefore shows it still.
  const seen = useRef<Set<string> | null>(null)
  if (isReady && !seen.current) {
    seen.current = new Set(entries.map((entry) => entry.id))
  }
  useEffect(() => {
    for (const entry of entries) seen.current?.add(entry.id)
  })

  async function move(from: number, to: number) {
    const entry = openEntries[from]
    if (!entry || to < 0 || to >= openEntries.length || to === from) return
    await store.setEntryPosition(
      entry.id,
      positionForMove(openEntries, from, to),
    )
    setAnnouncement(`${entry.text}, ${to + 1} of ${openEntries.length}`)
    // Moving the row in the DOM can drop focus; keep it on the handle for the next key press.
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-move-handle="${entry.id}"]`)
        ?.focus(),
    )
  }

  async function clearChecked() {
    const snapshot = await store.clearCompletedEntries(itemId)
    toast(`Cleared ${snapshot.entries.length} checked`, {
      action: { label: 'Undo', onClick: () => void store.restore(snapshot) },
    })
  }

  async function uncheckAll() {
    const previous = await store.uncheckAllEntries(itemId)
    toast(`Unchecked ${previous.length}`, {
      action: {
        label: 'Undo',
        onClick: () => void store.restoreChecks(previous),
      },
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
        {checked > 0 && !readOnly && (
          <div className="-mr-2 flex print:hidden">
            <Button onPress={() => void uncheckAll()} className={listAction}>
              Uncheck all
            </Button>
            <Button onPress={() => void clearChecked()} className={listAction}>
              Clear checked
            </Button>
          </div>
        )}
      </div>
      <p aria-live="assertive" className="sr-only">
        {announcement}
      </p>
      <ul>
        {entries.map((entry) => (
          <EntryRow
            key={`${entry.id}:${entry.text}`}
            store={store}
            entry={entry}
            added={seen.current !== null && !seen.current.has(entry.id)}
            readOnly={readOnly}
            movable={!readOnly && !entry.completed_at && openEntries.length > 1}
            onMove={(to) => void move(openEntries.indexOf(entry), to)}
            checker={
              entry.completed_at ? checkedBy(entry.completed_by) : undefined
            }
          />
        ))}
      </ul>
      {!readOnly && <AddEntry store={store} itemId={itemId} />}
    </section>
  )
}

function EntryRow({
  store,
  entry,
  added,
  readOnly,
  movable,
  onMove,
  checker,
}: {
  store: Store
  entry: Entry
  /** Just added: plays the entrance once, kept when the row re-renders. */
  added: boolean
  readOnly: boolean
  movable: boolean
  /** Moves this entry to an index among the open entries. */
  onMove: (to: number) => void
  checker?: string
}) {
  const done = entry.completed_at !== null
  const [entering] = useState(added)

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
    <li
      className={cn(
        'group relative flex items-center bg-background data-dragging:z-10 data-dragging:shadow-sm',
        entering && 'motion-safe:animate-[entry-in_180ms_ease-out]',
      )}
    >
      <Checkbox
        className="absolute -left-[2.375rem]"
        isSelected={done}
        isDisabled={readOnly}
        onChange={(selected) =>
          void store.setEntryCompleted(entry.id, selected)
        }
        aria-label={`Check ${entry.text}`}
      />
      <input
        dir="auto"
        defaultValue={entry.text}
        readOnly={readOnly}
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
      {checker && (
        <span className="shrink-0 pl-2 text-xs text-muted-foreground">
          <span className="sr-only">checked by </span>
          {checker}
        </span>
      )}
      {movable && <MoveHandle entry={entry} onMove={onMove} />}
      {/* Quiet until hovered on desktop; always there on touch, where hover does not exist. */}
      {!readOnly && (
        <Button
          onPress={() => void remove()}
          aria-label={`Remove ${entry.text}`}
          className="-mr-3 grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:data-focus-visible:opacity-100"
        >
          <X aria-hidden className="size-4" />
        </Button>
      )}
    </li>
  )
}

const rowAction =
  'grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 print:hidden'

/**
 * Drag to move an entry; with the keyboard, focus the handle and use the arrow keys. A plain
 * button, since dragging needs the raw pointer events that React Aria's press handling takes.
 */
function MoveHandle({
  entry,
  onMove,
}: {
  entry: Entry
  onMove: (to: number) => void
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const rows = openRows(event.currentTarget)
    const index = rows.indexOf(rowOf(event.currentTarget))
    const to = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      Home: 0,
      End: rows.length - 1,
    }[event.key]
    if (to === undefined) return
    event.preventDefault()
    onMove(to)
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    const handle = event.currentTarget
    const row = rowOf(handle)
    const rows = openRows(handle)
    const from = rows.indexOf(row)
    const startY = event.clientY
    handle.setPointerCapture(event.pointerId)
    row.dataset.dragging = ''

    const follow = (moveEvent: globalThis.PointerEvent) => {
      row.style.translate = `0 ${moveEvent.clientY - startY}px`
    }
    const drop = (upEvent: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', follow)
      row.style.translate = ''
      delete row.dataset.dragging
      // The new index is the number of other rows whose middle is above the pointer.
      const to = rows.filter((other) => {
        if (other === row) return false
        const { top, height } = other.getBoundingClientRect()
        return top + height / 2 < upEvent.clientY
      }).length
      if (to !== from) onMove(to)
    }
    handle.addEventListener('pointermove', follow)
    handle.addEventListener('lostpointercapture', drop, { once: true })
  }

  return (
    <button
      type="button"
      data-move-handle={entry.id}
      aria-label={`Move ${entry.text}`}
      aria-description="Drag, or use the arrow keys"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      className={cn(rowAction, 'cursor-grab touch-none active:cursor-grabbing')}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  )
}

const rowOf = (element: HTMLElement) => element.closest('li') as HTMLElement
const openRows = (element: HTMLElement) =>
  [
    ...(element.closest('ul')?.querySelectorAll<HTMLElement>('li') ?? []),
  ].filter((row) => row.querySelector('[data-move-handle]'))

function AddEntry({ store, itemId }: { store: Store; itemId: string }) {
  const [text, setText] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const suggestionsId = useId()
  // Every list's entries: what was bought or packed before is likely to come up again.
  const { data: allEntries } = useRows(store.entries)
  const suggestions = suggestEntries(allEntries, itemId)

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
    <form onSubmit={submit} className="relative flex items-center print:hidden">
      <span className="absolute -left-[2.375rem] grid size-11 place-items-center text-faint">
        <Plus aria-hidden className="size-4" />
      </span>
      <input
        ref={field}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onPaste={paste}
        placeholder="Add an item"
        aria-label="Add an item"
        list={suggestionsId}
        autoComplete="off"
        maxLength={500}
        enterKeyHint="enter"
        className="h-11 min-w-0 flex-1 bg-transparent font-serif text-lg outline-none placeholder:text-faint"
      />
      {/* The browser filters these as the user types, with its own keyboard and screen reader support. */}
      <datalist id={suggestionsId}>
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      {/* A scanned product's name lands in the field, to check or change before adding it. */}
      <ScanButton
        onProduct={(name) => {
          setText(name)
          field.current?.focus()
        }}
      />
    </form>
  )
}
