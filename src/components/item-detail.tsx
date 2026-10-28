import { eq, useLiveQuery } from '@tanstack/react-db'
import { Link, useNavigate } from '@tanstack/react-router'
import { Archive, ArrowLeft, Copy, Pin, Share, Trash2 } from 'lucide-react'
import { type RefObject, useEffect, useId, useRef, useState } from 'react'
import { Button, ToggleButton } from 'react-aria-components'
import { toast } from 'sonner'
import { EntryList } from '#/components/entry-list'
import { itemLabels } from '#/components/item-labels'
import { Checkbox } from '#/components/ui/checkbox'
import { ChoiceGroup } from '#/components/ui/choice-group'
import { itemToText } from '#/data/export'
import {
  type Item,
  type Priority,
  priorities,
  type TaskStatus,
  taskStatuses,
  titleSchema,
} from '#/data/schema'
import type { Store } from '#/data/store'
import { useAccount } from '#/lib/account'
import { formatShortDate } from '#/lib/dates'
import { renderMarkdown } from '#/lib/markdown'
import { canEdit, useSpaces } from '#/lib/spaces'
import { cn } from '#/lib/utils'

// No display or hover color here: each button sets its own, since `cn` adds classes and does not
// override them.
const iconButton =
  'size-11 place-items-center rounded-sm text-muted-foreground transition-colors data-focus-visible:outline-2 motion-reduce:transition-none'

// Phones and Safari open the share sheet; elsewhere the text goes to the clipboard.
const canShare = () => typeof navigator.share === 'function'

const priorityChoices = priorities.map(({ value, label }) => ({
  value: String(value),
  label,
}))

// "To do" is no status at all, so a task that never needed one reads the same.
const statusChoices = [{ value: 'to_do', label: 'To do' }, ...taskStatuses]

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
  const account = useAccount()
  const { spaces, byId } = useSpaces()
  const label = itemLabels[item.type]
  const pinned = item.pinned_at !== null
  const space = item.space_id ? byId.get(item.space_id) : undefined
  // Viewers get a read-only page; the server refuses their writes anyway.
  const canChange = !space || canEdit(space.role)
  // Trashed items are read-only until restored.
  const editable = canChange && item.deleted_at === null
  const archived = item.archived_at !== null
  // Only other people are named; your own notes and checks need no label.
  const otherName = (userId: string | null) =>
    userId && userId !== account?.userId
      ? space?.members.find((member) => member.user_id === userId)?.member_name
      : undefined
  const author = otherName(item.created_by)
  const doneBy = item.completed_at ? otherName(item.completed_by) : undefined
  const deletedBy = item.deleted_at ? otherName(item.deleted_by) : undefined
  const moveTargets = spaces.filter((target) => canEdit(target.role))
  const saveBody = useRef<(() => Promise<void>) | null>(null)
  const dueId = useId()

  async function move(spaceId: string) {
    await store.moveItem(item.id, spaceId)
    toast(`Moved to ${byId.get(spaceId)?.name}`)
  }

  async function trash() {
    await navigate({ to: '/', search: true })
    await store.trashItem(item.id)
    toast(`${label} moved to the trash`, {
      action: { label: 'Undo', onClick: () => void store.restoreItem(item.id) },
    })
  }

  async function duplicate() {
    const id = await store.duplicateItem(item.id)
    await navigate({
      to: '/items/$itemId',
      params: { itemId: id },
      search: true,
    })
    toast(`${label} duplicated`, {
      action: { label: 'Undo', onClick: () => void store.deleteItem(id) },
    })
  }

  async function archive(next: boolean) {
    await store.setItemArchived(item.id, next)
    toast(next ? `${label} archived` : `${label} back from the archive`, {
      action: {
        label: 'Undo',
        onClick: () => void store.setItemArchived(item.id, !next),
      },
    })
  }

  async function convert() {
    const to = item.type === 'note' ? 'list' : 'note'
    // Text typed in the last half second is not saved yet; it must be part of the conversion.
    await saveBody.current?.()
    try {
      const snapshot = await store.convertItem(item.id, to)
      toast(`${label} turned into a ${to}`, {
        action: {
          label: 'Undo',
          onClick: () => void store.undoConversion(snapshot),
        },
      })
    } catch (error) {
      console.error('Could not convert the item', error)
      toast(`This ${label.toLowerCase()} is too long to turn into a ${to}`)
    }
  }

  async function share() {
    await store.entries.preload()
    const text = itemToText(
      item,
      store.entries.toArray.filter((entry) => entry.item_id === item.id),
    )
    if (canShare()) {
      // Cancelling the share sheet rejects; there is nothing to report.
      await navigator.share({ title: item.title, text }).catch(() => {})
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied as text')
    } catch {
      toast('Could not copy. The browser did not allow it.')
    }
  }

  async function deleteForever() {
    await navigate({ to: '/', search: true })
    const snapshot = await store.deleteItem(item.id)
    toast(`${label} deleted for good`, {
      action: { label: 'Undo', onClick: () => void store.restore(snapshot) },
    })
  }

  return (
    <article className="flex flex-col pb-10">
      <header className="-ml-3 flex items-center justify-between pt-2 pb-6">
        <Link
          to="/"
          search={true}
          // On a wide screen the list is already beside the item.
          className="flex h-11 items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 lg:invisible"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Everything
        </Link>
        <div className="-mr-3 flex">
          <Button
            onPress={() => void share()}
            aria-label={canShare() ? 'Share' : 'Copy as text'}
            className={cn(iconButton, 'grid hover:text-foreground')}
          >
            <Share aria-hidden className="size-[1.125rem]" />
          </Button>
          <Button
            onPress={() => void duplicate()}
            aria-label={`Duplicate ${label.toLowerCase()}`}
            className={cn(
              iconButton,
              'hover:text-foreground',
              editable ? 'grid' : 'hidden',
            )}
          >
            <Copy aria-hidden className="size-[1.125rem]" />
          </Button>
          <ToggleButton
            isSelected={archived}
            onChange={(selected) => void archive(selected)}
            aria-label="Archive"
            className={cn(
              iconButton,
              'hover:text-foreground data-selected:text-foreground',
              editable ? 'grid' : 'hidden',
            )}
          >
            <Archive aria-hidden className="size-[1.125rem]" />
          </ToggleButton>
          <ToggleButton
            isSelected={pinned}
            onChange={(selected) => void store.setItemPinned(item.id, selected)}
            aria-label="Pin to the top"
            className={cn(
              iconButton,
              'hover:text-foreground data-selected:text-foreground',
              editable ? 'grid' : 'hidden',
            )}
          >
            {({ isSelected }) => (
              <Pin
                aria-hidden
                className={cn('size-[1.125rem]', isSelected && 'fill-current')}
              />
            )}
          </ToggleButton>
          <Button
            onPress={() => void trash()}
            aria-label={`Move ${label.toLowerCase()} to the trash`}
            className={cn(
              iconButton,
              'hover:text-destructive',
              editable ? 'grid' : 'hidden',
            )}
          >
            <Trash2 aria-hidden className="size-[1.125rem]" />
          </Button>
        </div>
      </header>

      <div className="pl-10">
        {item.deleted_at && (
          <div className="mb-6 flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              In the trash since {formatShortDate(item.deleted_at)}
              {deletedBy && `, deleted by ${deletedBy}`}.
            </p>
            {canChange && (
              <div className="-ml-2 flex gap-2">
                <Button
                  onPress={() => void store.restoreItem(item.id)}
                  className="rounded-sm px-2 py-2 text-foreground underline underline-offset-4 data-focus-visible:outline-2"
                >
                  Restore
                </Button>
                <Button
                  onPress={() => void deleteForever()}
                  className="rounded-sm px-2 py-2 hover:text-destructive data-focus-visible:outline-2"
                >
                  Delete forever
                </Button>
              </div>
            )}
          </div>
        )}
        {/* The title is edited in place; the heading keeps the page outline for screen readers. */}
        <h1 className="sr-only">{item.title}</h1>
        <p className="text-xs text-muted-foreground">
          {label} · {formatShortDate(item.created_at)}
          {space && !space.personal && ` · ${space.name}`}
          {author && ` · by ${author}`}
          {doneBy && ` · done by ${doneBy}`}
          {pinned && ' · Pinned'}
          {archived && ' · Archived'}
          {!canChange && ' · View only'}
        </p>
        <div className="relative">
          {item.type === 'task' && (
            <Checkbox
              className="absolute top-1 -left-[2.375rem]"
              isSelected={item.completed_at !== null}
              isDisabled={!editable}
              onChange={(selected) =>
                void store.setItemCompleted(item.id, selected)
              }
              aria-label="Done"
            />
          )}
          <TitleField store={store} item={item} readOnly={!editable} />
        </div>

        {item.type === 'task' && (
          <ChoiceGroup
            label="Priority"
            showLabel
            choices={priorityChoices}
            value={String(item.priority)}
            isDisabled={!editable}
            onChange={(value) =>
              void store.setItemPriority(item.id, Number(value) as Priority)
            }
            className="mb-2"
          />
        )}

        {item.type === 'task' && !item.completed_at && (
          <ChoiceGroup
            label="Status"
            showLabel
            choices={statusChoices}
            value={item.status ?? 'to_do'}
            isDisabled={!editable}
            onChange={(value) =>
              void store.setItemStatus(
                item.id,
                value === 'to_do' ? null : (value as TaskStatus),
              )
            }
            className="mb-2"
          />
        )}

        {item.type === 'task' && !item.completed_at && (
          <div className="mb-2 flex min-h-11 items-center gap-4 text-sm">
            <label htmlFor={dueId} className="text-muted-foreground">
              Due
            </label>
            {/* The browser's own date picker: a calendar on phones, typed on desktop. */}
            <input
              id={dueId}
              type="date"
              value={item.due_on ?? ''}
              disabled={!editable}
              onChange={(event) =>
                void store.setItemDue(item.id, event.target.value || null)
              }
              className="min-h-11 bg-transparent text-foreground outline-none focus-visible:rounded-sm focus-visible:outline-2 disabled:opacity-50"
            />
            {item.due_on && editable && (
              <Button
                onPress={() => void store.setItemDue(item.id, null)}
                className="rounded-sm py-2 text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
              >
                No date
              </Button>
            )}
          </div>
        )}

        {item.type === 'list' ? (
          <EntryList
            store={store}
            itemId={item.id}
            readOnly={!editable}
            checkedBy={otherName}
          />
        ) : (
          <BodyField
            store={store}
            item={item}
            readOnly={!editable}
            saveRef={saveBody}
          />
        )}

        {editable && item.type !== 'task' && (
          <Button
            onPress={() => void convert()}
            className="mt-6 -ml-2 block rounded-sm px-2 py-2 text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
          >
            {item.type === 'note' ? 'Turn into a list' : 'Turn into a note'}
          </Button>
        )}

        {editable && item.space_id && moveTargets.length > 1 && (
          <ChoiceGroup
            label="Space"
            showLabel
            choices={moveTargets.map((target) => ({
              value: target.id,
              label: target.name,
            }))}
            value={item.space_id}
            onChange={(spaceId) => void move(spaceId)}
            className="mt-8"
          />
        )}
      </div>
    </article>
  )
}

function TitleField({
  store,
  item,
  readOnly,
}: {
  store: Store
  item: Item
  readOnly: boolean
}) {
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
      readOnly={readOnly}
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
function BodyField({
  store,
  item,
  readOnly,
  saveRef,
}: {
  store: Store
  item: Item
  readOnly: boolean
  /** Lets the page save pending text before it changes the item (see `convert`). */
  saveRef: RefObject<(() => Promise<void>) | null>
}) {
  const [body, setBody] = useState(item.body)
  const hintId = useId()
  const flush = useRef(async () => {})
  flush.current = async () => {
    // A converted item has no body field any more; its text went into the conversion.
    if (
      body.trim() === item.body ||
      store.items.get(item.id)?.type !== item.type
    )
      return
    await store.updateItem(item.id, { body }).catch((error: unknown) => {
      console.error('Could not save the text', error)
    })
  }
  saveRef.current = () => flush.current()

  // biome-ignore lint/correctness/useExhaustiveDependencies: every edit restarts the debounce
  useEffect(() => {
    const timer = setTimeout(() => void flush.current(), saveDelay)
    return () => clearTimeout(timer)
  }, [body])

  // Leaving the page unmounts the field; closing the tab or switching apps only hides it.
  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void flush.current()
    }
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
      void flush.current()
    }
  }, [])

  const [editing, setEditing] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)
  // After Edit or a tap on the text, typing goes straight into the source.
  useEffect(() => {
    if (editing) textarea.current?.focus()
  }, [editing])
  const label = item.type === 'note' ? 'Note' : 'Details'

  // Written text reads as formatted Markdown; tapping it (or Edit) shows the source to change.
  if (!editing && body.trim()) {
    return (
      <div className="flex flex-col items-start gap-2">
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: a pointer shortcut; the Edit button below is the keyboard way in */}
        <section
          aria-label={label}
          onClick={(event) => {
            if (readOnly || (event.target as HTMLElement).closest('a')) return
            setEditing(true)
          }}
          className={cn('markdown w-full py-2', !readOnly && 'cursor-text')}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown escapes HTML and drops script links
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
        {!readOnly && (
          <Button
            onPress={() => setEditing(true)}
            className="rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
          >
            Edit {label.toLowerCase()}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={body}
        readOnly={readOnly}
        ref={textarea}
        onChange={(event) => setBody(event.target.value)}
        // Typing into an empty note must not switch it to the formatted view after one letter.
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        placeholder={item.type === 'note' ? 'Write something' : 'Add details'}
        aria-label={label}
        aria-describedby={readOnly ? undefined : hintId}
        maxLength={20_000}
        className="field-sizing-content min-h-48 w-full resize-none bg-transparent py-2 font-serif text-lg leading-relaxed outline-none placeholder:text-faint"
      />
      {!readOnly && (
        <p id={hintId} className="text-xs text-muted-foreground">
          Markdown works: **bold**, *italic*, # heading, - list, [link](url).
        </p>
      )}
    </div>
  )
}
