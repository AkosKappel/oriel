import { eq, useLiveQuery } from '@tanstack/react-db'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pin, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, ToggleButton } from 'react-aria-components'
import { toast } from 'sonner'
import { EntryList } from '#/components/entry-list'
import { itemLabels } from '#/components/item-labels'
import { Checkbox } from '#/components/ui/checkbox'
import { ChoiceGroup } from '#/components/ui/choice-group'
import {
  type Item,
  type Priority,
  priorities,
  titleSchema,
} from '#/data/schema'
import type { Store } from '#/data/store'
import { formatShortDate } from '#/lib/dates'
import { cn } from '#/lib/utils'

const iconButton =
  'grid size-11 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground data-focus-visible:outline-2 motion-reduce:transition-none'

const priorityChoices = priorities.map(({ value, label }) => ({
  value: String(value),
  label,
}))

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
      <div className="flex flex-1 flex-col justify-center gap-2 pb-16 pl-10">
        <p className="font-serif text-2xl italic">This page was torn out.</p>
        <p className="text-sm text-muted-foreground">
          It was deleted, here or on another device.{' '}
          <Link to="/" className="text-foreground underline underline-offset-4">
            Back to everything
          </Link>
        </p>
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
    <article className="flex flex-col pb-10">
      <header className="-ml-3 flex items-center justify-between pt-2 pb-6">
        <Link
          to="/"
          className="flex h-11 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Everything
        </Link>
        <div className="-mr-3 flex">
          <ToggleButton
            isSelected={pinned}
            onChange={(selected) => void store.setItemPinned(item.id, selected)}
            aria-label="Pin to the top"
            className={cn(iconButton, 'data-selected:text-foreground')}
          >
            {({ isSelected }) => (
              <Pin
                aria-hidden
                className={cn('size-[1.125rem]', isSelected && 'fill-current')}
              />
            )}
          </ToggleButton>
          <Button
            onPress={() => void remove()}
            aria-label={`Delete ${label.toLowerCase()}`}
            className={cn(iconButton, 'hover:text-destructive')}
          >
            <Trash2 aria-hidden className="size-[1.125rem]" />
          </Button>
        </div>
      </header>

      <div className="pl-10">
        <p className="text-xs text-muted-foreground">
          {label} · {formatShortDate(item.created_at)}
          {pinned && ' · Pinned'}
        </p>
        <div className="relative">
          {item.type === 'task' && (
            <Checkbox
              className="absolute top-1 -left-[2.375rem]"
              isSelected={item.completed_at !== null}
              onChange={(selected) =>
                void store.setItemCompleted(item.id, selected)
              }
              aria-label="Done"
            />
          )}
          <TitleField store={store} item={item} />
        </div>

        {item.type === 'task' && (
          <ChoiceGroup
            label="Priority"
            showLabel
            choices={priorityChoices}
            value={String(item.priority)}
            onChange={(value) =>
              void store.setItemPriority(item.id, Number(value) as Priority)
            }
            className="mb-2"
          />
        )}

        {item.type === 'list' ? (
          <EntryList store={store} itemId={item.id} />
        ) : (
          <BodyField store={store} item={item} />
        )}
      </div>
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
        'field-sizing-content w-full resize-none bg-transparent py-2 font-serif text-[2rem] leading-tight tracking-tight outline-none',
        item.completed_at && 'text-muted-foreground line-through decoration-2',
      )}
    />
  )
}

const saveDelay = 500

/** Saves while typing (debounced), on leaving the page and when the app is hidden. */
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

  // Leaving the page unmounts the field; closing the tab or switching apps only hides it.
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush.current()
    }
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
      flush.current()
    }
  }, [])

  return (
    <textarea
      value={body}
      onChange={(event) => setBody(event.target.value)}
      placeholder={item.type === 'note' ? 'Write something' : 'Add details'}
      aria-label={item.type === 'note' ? 'Note' : 'Details'}
      maxLength={20_000}
      className="field-sizing-content min-h-48 w-full resize-none bg-transparent py-2 font-serif text-lg leading-relaxed outline-none placeholder:text-faint"
    />
  )
}
