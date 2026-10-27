import { ArrowUp } from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { itemIcons, itemLabels } from '#/components/item-icon'
import { parseCapture } from '#/data/capture'
import { type ItemType, itemTypes, newItemSchema } from '#/data/schema'
import type { Store } from '#/data/store'

const placeholders: Record<ItemType, string> = {
  note: 'Write a note',
  list: 'Groceries: milk, eggs, bread',
  task: 'Call the vet',
}

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
 */
export function CaptureBar({
  store,
  preferredType,
}: {
  store: Store
  preferredType?: ItemType
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
  const hintId = useId()

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

  const draft = parseCapture(text, type)

  function chooseType(next: ItemType) {
    setType(next)
    setError(null)
    try {
      localStorage.setItem(typeStorageKey, next)
    } catch {
      // Remembering the type is a convenience; private mode may block storage.
    }
    fieldRef.current?.focus()
  }

  function save() {
    if (!draft) return
    const result = newItemSchema.safeParse(draft)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    const captured = text
    setText('')
    setError(null)
    store.createItem(draft).then(
      (id) =>
        toast(`${itemLabels[draft.type]} saved`, {
          action: { label: 'Undo', onClick: () => void store.deleteItem(id) },
        }),
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
    (draft?.type === 'list' && draft.entries.length > 0
      ? `${draft.title} · ${draft.entries.length} ${draft.entries.length === 1 ? 'item' : 'items'}`
      : null)

  return (
    <form
      onSubmit={submit}
      aria-label="Capture"
      className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur"
    >
      <fieldset className="flex gap-1">
        <legend className="sr-only">Type</legend>
        {itemTypes.map((option) => {
          const Icon = itemIcons[option]
          return (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground has-checked:bg-secondary has-checked:text-foreground has-focus-visible:outline-2"
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => chooseType(option)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {itemLabels[option]}
            </label>
          )
        })}
      </fieldset>
      <div className="flex items-end gap-2">
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
          aria-describedby={hint ? hintId : undefined}
          aria-invalid={error ? true : undefined}
          enterKeyHint="done"
          rows={1}
          className="field-sizing-content max-h-40 min-h-11 min-w-0 flex-1 resize-none rounded-lg border bg-card px-3 py-2.5 placeholder:text-muted-foreground aria-invalid:border-destructive"
        />
        <button
          type="submit"
          aria-label="Save"
          disabled={!draft}
          className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40"
        >
          <ArrowUp aria-hidden className="size-5" />
        </button>
      </div>
      {hint && (
        <p
          id={hintId}
          role={error ? 'alert' : undefined}
          className={`truncate text-xs ${error ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {hint}
        </p>
      )}
    </form>
  )
}
