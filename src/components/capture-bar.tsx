import { useLiveQuery } from '@tanstack/react-db'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { itemLabels } from '#/components/item-labels'
import { ChoiceGroup } from '#/components/ui/choice-group'
import { parseAppend, parseCapture } from '#/data/capture'
import { itemsInView } from '#/data/organize'
import { type ItemType, itemTypes, newItemSchema } from '#/data/schema'
import type { Store } from '#/data/store'
import { canEdit, useSpaces } from '#/lib/spaces'
import { requestPersistentStorage } from '#/lib/storage'
import { cn } from '#/lib/utils'

const placeholders: Record<ItemType, string> = {
  note: 'Write something',
  list: 'Groceries: milk, eggs, bread',
  task: 'Call the vet',
}

const captureChoices = itemTypes.map((value) => ({
  value,
  label: itemLabels[value],
}))

const typeStorageKey = 'oriel.capture-type'

function readStoredType(): ItemType {
  try {
    const stored = localStorage.getItem(typeStorageKey)
    return itemTypes.find((type) => type === stored) ?? 'note'
  } catch {
    return 'note'
  }
}

function isEditable(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

/**
 * Always-visible capture field at the bottom of the screen. Enter saves and keeps the focus for
 * the next item; Shift+Enter starts a new line. `/` or `n` focuses it from anywhere on the page.
 * "+Groceries eggs, milk" adds to a list that exists instead (see `parseAppend`).
 */
export function CaptureBar({
  store,
  preferredType,
  spaceId,
}: {
  store: Store
  preferredType?: ItemType
  /** The space being viewed; new items go there instead of the personal space. */
  spaceId?: string
}) {
  const [type, setType] = useState<ItemType>(
    () => preferredType ?? readStoredType(),
  )

  // Filtering the home page to one type makes that the type to capture.
  useEffect(() => {
    if (preferredType) setType(preferredType)
  }, [preferredType])
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const tapped = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const hintId = useId()

  // Toasts sit just above the bar while it is on screen (it is hidden beside an open item on a
  // phone); a hidden element measures 0.
  useEffect(() => {
    const form = formRef.current
    if (!form) return
    const root = document.documentElement.style
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize[0]?.blockSize ?? 0
      if (height > 0) root.setProperty('--capture-height', `${height}px`)
      else root.removeProperty('--capture-height')
    })
    observer.observe(form)
    return () => {
      observer.disconnect()
      root.removeProperty('--capture-height')
    }
  }, [])

  useEffect(() => {
    function focusOnShortcut(event: globalThis.KeyboardEvent) {
      if (event.key !== '/' && event.key !== 'n') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isEditable(event.target)) return
      event.preventDefault()
      fieldRef.current?.focus()
    }
    window.addEventListener('keydown', focusOnShortcut)
    return () => window.removeEventListener('keydown', focusOnShortcut)
  }, [])

  const { byId } = useSpaces()
  const { data: items } = useLiveQuery({
    query: (q) => q.from({ item: store.items }),
  })
  const appendDraft = text.trimStart().startsWith('+')
    ? parseAppend(
        text,
        itemsInView(items).filter(
          (item) =>
            item.type === 'list' &&
            (spaceId ? item.space_id === spaceId : true) &&
            (!item.space_id || canEdit(byId.get(item.space_id)?.role)),
        ),
      )
    : null
  const draft = appendDraft ? null : parseCapture(text, type)

  function chooseType(next: ItemType) {
    setType(next)
    setError(null)
    try {
      localStorage.setItem(typeStorageKey, next)
    } catch {
      // Remembering the type is a convenience; private mode may block storage.
    }
    // Back to the field after a tap, so the phone keyboard stays open; arrow keys stay in the group.
    // Deferred a frame because React Aria focuses the radio itself after the change.
    if (tapped.current) requestAnimationFrame(() => fieldRef.current?.focus())
    tapped.current = false
  }

  function append() {
    if (!appendDraft) return
    if (!appendDraft.list) {
      setError('No list starts with that name')
      return
    }
    const { list, entries } = appendDraft
    if (entries.length === 0) {
      setError(`Type what to add to ${list.title}`)
      return
    }
    const captured = text
    setText('')
    setError(null)
    store.addEntries(list.id, entries).then(
      (ids) => {
        toast(`Added ${entries.length} to ${list.title}`, {
          action: {
            label: 'Undo',
            onClick: () => void Promise.all(ids.map(store.deleteEntry)),
          },
        })
      },
      (saveError: unknown) => {
        console.error('Could not add to the list', saveError)
        setText(captured)
        setError('Could not add. Keep each entry under 500 characters.')
      },
    )
  }

  function save() {
    if (appendDraft) {
      append()
      return
    }
    if (!draft) return
    const result = newItemSchema.safeParse(draft)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    const captured = text
    setText('')
    setError(null)
    store.createItem(draft, { spaceId }).then(
      (id) => {
        toast(`${itemLabels[draft.type]} saved`, {
          action: { label: 'Undo', onClick: () => void store.deleteItem(id) },
        })
        void requestPersistentStorage()
      },
      (saveError: unknown) => {
        console.error('Could not save the captured item', saveError)
        setText(captured)
        setError('Could not save. Try again.')
      },
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    save()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return
    event.preventDefault()
    save()
  }

  const hint =
    error ??
    (appendDraft?.list
      ? appendDraft.entries.length > 0
        ? `Add ${appendDraft.entries.length} to ${appendDraft.list.title}`
        : `Adding to ${appendDraft.list.title}`
      : appendDraft
        ? 'No list starts with that name yet'
        : draft?.type === 'list' && draft.entries.length > 0
          ? `${draft.title} · ${draft.entries.length} ${draft.entries.length === 1 ? 'item' : 'items'}`
          : '')

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      aria-label="Capture"
      className="sticky bottom-0 -mx-4 flex flex-col bg-background pt-2 pr-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-14"
    >
      <div
        // Capture phase: React Aria stops pointer events from bubbling out of the radios.
        onPointerDownCapture={() => {
          tapped.current = true
        }}
      >
        <ChoiceGroup
          label="Type"
          choices={captureChoices}
          value={type}
          onChange={chooseType}
        />
      </div>
      <div className="flex items-end gap-3 border-b-[1.5px] border-foreground/25 focus-within:border-foreground has-aria-invalid:border-destructive">
        <textarea
          ref={fieldRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholders[type]}
          aria-label={`New ${itemLabels[type].toLowerCase()}`}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          enterKeyHint="done"
          rows={1}
          className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 font-serif text-lg outline-none placeholder:text-faint"
        />
        <Button
          type="submit"
          className="h-11 shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground data-focus-visible:rounded-sm data-focus-visible:outline-2 data-pressed:text-foreground motion-reduce:transition-none"
        >
          Add
        </Button>
      </div>
      <p
        id={hintId}
        role={error ? 'alert' : undefined}
        className={cn(
          'min-h-6 truncate pt-1.5 text-xs',
          error ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {hint}
      </p>
    </form>
  )
}
