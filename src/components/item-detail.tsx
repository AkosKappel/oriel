import { eq, useLiveQuery } from '@tanstack/react-db'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pin, PinOff, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '#/components/checkbox'
import { EntryList } from '#/components/entry-list'
import { itemLabels } from '#/components/item-icon'
import {
  type Item,
  type Priority,
  priorities,
  titleSchema,
} from '#/data/schema'
import type { Store } from '#/data/store'
import { cn } from '#/lib/utils'

export function ItemDetail({
  store,
  itemId,
}: {
  store: Store
  itemId: string
}) {
  const { data: item, isLoading } = useLiveQuery({
    query: (q) =>
      q
        .from({ item: store.items })
        .where(({ item }) => eq(item.id, itemId))
        .findOne(),
  })

  if (isLoading) return null

  if (!item) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="font-medium">This item no longer exists</p>
        <Link to="/" className="text-sm underline underline-offset-4">
          Back to all items
        </Link>
      </div>
    )
  }

  // Keyed by id so the editor's local text state starts fresh for every item.
  return <ItemEditor key={item.id} store={store} item={item} />
}

function ItemEditor({ store, item }: { store: Store; item: Item }) {
  const navigate = useNavigate()
  const label = itemLabels[item.type]
  const pinned = item.pinned_at !== null

  async function remove() {
    await navigate({ to: '/' })
    const snapshot = await store.deleteItem(item.id)
    toast(`${label} deleted`, {
      action: { label: 'Undo', onClick: () => void store.restore(snapshot) },
    })
  }

  return (
    <article className="flex flex-col gap-4 pb-8">
      <header className="-mx-2 flex items-center justify-between">
        <Link
          to="/"
          className="flex h-11 items-center gap-2 rounded-md px-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-5" />
          All items
        </Link>
        <div className="flex">
          <button
            type="button"
            onClick={() => void store.setItemPinned(item.id, !pinned)}
            aria-pressed={pinned}
            aria-label={pinned ? 'Unpin' : 'Pin to the top'}
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground aria-pressed:text-primary"
          >
            {pinned ? (
              <PinOff aria-hidden className="size-5" />
            ) : (
              <Pin aria-hidden className="size-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            aria-label={`Delete ${label.toLowerCase()}`}
            className="grid size-11 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
          >
            <Trash2 aria-hidden className="size-5" />
          </button>
        </div>
      </header>

      <div className="flex items-start gap-1">
        {item.type === 'task' && (
          <Checkbox
            className="-ml-3"
            checked={item.completed_at !== null}
            onChange={(event) =>
              void store.setItemCompleted(item.id, event.target.checked)
            }
            aria-label="Done"
          />
        )}
        <TitleField store={store} item={item} />
      </div>

      {item.type === 'task' && <PriorityField store={store} item={item} />}

      {item.type === 'list' ? (
        <EntryList store={store} itemId={item.id} />
      ) : (
        <BodyField store={store} item={item} />
      )}
    </article>
  )
}

function TitleField({ store, item }: { store: Store; item: Item }) {
  function save(field: HTMLTextAreaElement) {
    const result = titleSchema.safeParse(field.value)
    if (!result.success) {
      field.value = item.title
      return
    }
    if (result.data !== item.title)
      void store.updateItem(item.id, { title: field.value })
  }

  return (
    <textarea
      // Remounts when the title changes elsewhere (another tab), so it never shows stale text.
      key={item.title}
      defaultValue={item.title}
      aria-label="Title"
      rows={1}
      maxLength={200}
      enterKeyHint="done"
      onBlur={(event) => save(event.currentTarget)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      className={cn(
        '-mr-2 field-sizing-content min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-2 text-xl font-semibold focus:bg-card',
        // Tasks have the checkbox on the left; other titles line up with the page edge.
        item.type !== 'task' && '-ml-2',
        item.completed_at && 'text-muted-foreground line-through',
      )}
    />
  )
}

function PriorityField({ store, item }: { store: Store; item: Item }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1">
      <legend className="sr-only">Priority</legend>
      <span aria-hidden className="mr-1 text-sm text-muted-foreground">
        Priority
      </span>
      {priorities.map(({ value, label }) => (
        <label
          key={value}
          className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-muted-foreground has-checked:bg-secondary has-checked:text-foreground has-focus-visible:outline-2"
        >
          <input
            type="radio"
            name="priority"
            value={value}
            checked={item.priority === value}
            onChange={() =>
              void store.setItemPriority(item.id, value as Priority)
            }
            className="sr-only"
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}

const saveDelay = 500

/** Saves while typing (debounced) and on leaving the page, so no keystroke is lost. */
function BodyField({ store, item }: { store: Store; item: Item }) {
  const [body, setBody] = useState(item.body)
  const flush = useRef(() => {})
  flush.current = () => {
    if (body.trim() === item.body || !store.items.has(item.id)) return
    store.updateItem(item.id, { body }).catch((error: unknown) => {
      console.error('Could not save the text', error)
    })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: every edit restarts the debounce
  useEffect(() => {
    const timer = setTimeout(() => flush.current(), saveDelay)
    return () => clearTimeout(timer)
  }, [body])

  useEffect(() => () => flush.current(), [])

  return (
    <textarea
      value={body}
      onChange={(event) => setBody(event.target.value)}
      placeholder={item.type === 'note' ? 'Write something' : 'Add details'}
      aria-label={item.type === 'note' ? 'Note' : 'Details'}
      maxLength={20_000}
      className="-mx-2 field-sizing-content min-h-40 resize-none rounded-md bg-transparent px-2 py-2 leading-relaxed placeholder:text-muted-foreground focus:bg-card"
    />
  )
}
