import { Link } from '@tanstack/react-router'
import { type PointerEvent, type ReactNode, useRef } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { itemLabels } from '#/components/item-labels'
import { Checkbox } from '#/components/ui/checkbox'
import {
  countEntries,
  type DueFilter,
  itemsInView,
  organizeItems,
  previewLine,
  searchItems,
  trashDays,
  type View,
  withDue,
  withStatus,
} from '#/data/organize'
import {
  type Item,
  type ItemType,
  priorities,
  statusLabel,
  type TaskStatus,
} from '#/data/schema'
import type { Store } from '#/data/store'
import { describeDue, formatShortDate, localDay } from '#/lib/dates'
import { tick } from '#/lib/haptics'
import { canEdit, type SpaceView } from '#/lib/spaces'
import { useRows } from '#/lib/use-rows'
import { cn } from '#/lib/utils'

const emptyMessages: Record<ItemType | 'all', string> = {
  all: 'Notes, lists and tasks you write down will show up here.',
  note: 'Notes you write down will show up here.',
  list: 'Lists you start will show up here.',
  task: 'Tasks you write down will show up here.',
}

type EntryCounts = ReturnType<typeof countEntries>

export function ItemList({
  store,
  type,
  status,
  due,
  spaceId,
  query = '',
  view,
  spaces,
}: {
  store: Store
  type?: ItemType
  /** With tasks: only open tasks in this state. */
  status?: TaskStatus
  /** With tasks: only open tasks due by today or after it. */
  due?: DueFilter
  /** Show one space only. */
  spaceId?: string
  /** Show only items that contain these words. */
  query?: string
  /** The archive or the trash instead of home. */
  view?: View
  spaces: Map<string, SpaceView>
}) {
  const { data: items, isLoading } = useRows(store.items)
  const { data: entries } = useRows(store.entries)

  if (isLoading) return null

  const today = localDay(new Date())
  const shown = withDue(
    withStatus(
      searchItems(
        itemsInView(
          spaceId ? items.filter((item) => item.space_id === spaceId) : items,
          view,
        ),
        entries,
        query,
      ),
      type === 'task' ? status : undefined,
    ),
    type === 'task' ? due : undefined,
    today,
  )
  const counts = countEntries(entries)

  if (view) {
    return (
      <PastItems
        view={view}
        store={store}
        items={type ? shown.filter((item) => item.type === type) : shown}
        query={query}
        counts={counts}
        spaces={spaces}
        showSpace={!spaceId}
      />
    )
  }

  const { pinned, open, completed } = organizeItems(shown, type)

  if (pinned.length + open.length + completed.length === 0) {
    if (due && type === 'task' && !query.trim()) {
      return (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {due === 'today' ? 'Nothing due today.' : 'Nothing due later.'}
        </p>
      )
    }
    if (query.trim()) {
      return (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          Nothing here mentions “{query.trim()}”.
        </p>
      )
    }
    return (
      <div className="flex flex-1 flex-col justify-center gap-2 pb-16">
        <p className="font-serif text-2xl italic">A blank page.</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {emptyMessages[type ?? 'all']}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {pinned.length > 0 && (
        <Section title="Pinned">
          <Rows
            store={store}
            items={pinned}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
          />
        </Section>
      )}
      {open.length > 0 && (
        <Section title={pinned.length > 0 ? 'Everything else' : undefined}>
          <Rows
            store={store}
            items={open}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
          />
        </Section>
      )}
      {completed.length > 0 && (
        <details className="group">
          <summary className="flex h-11 w-fit cursor-pointer list-none items-center text-sm text-muted-foreground hover:text-foreground">
            <span className="group-open:hidden">
              Show {completed.length} completed
            </span>
            <span className="hidden group-open:inline">Hide completed</span>
          </summary>
          <Rows
            store={store}
            items={completed}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
          />
        </details>
      )}
    </div>
  )
}

const viewTitles: Record<View, string> = { archive: 'Archive', trash: 'Trash' }

/** The archive and the trash: one list, most recent first, each row saying when it went there. */
function PastItems({
  view,
  items,
  query,
  ...context
}: RowContext & { view: View; items: Item[]; query: string }) {
  async function emptyTrash() {
    const snapshot = await context.store.deleteTrashedBefore(
      new Date().toISOString(),
    )
    const count = snapshot.items.length
    toast(
      count === 1
        ? 'Deleted 1 item for good'
        : `Deleted ${count} items for good`,
      {
        action: {
          label: 'Undo',
          onClick: () => void context.store.restore(snapshot),
        },
      },
    )
  }

  return (
    <section aria-labelledby="past-items" className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between">
        <h2 id="past-items" className="font-serif text-2xl">
          {viewTitles[view]}
        </h2>
        <Link
          to="/"
          search={(previous) => ({ ...previous, view: undefined })}
          className="-mr-2 rounded-sm px-2 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          Close
        </Link>
      </div>
      {view === 'trash' && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Deleted items stay here for {trashDays} days.</p>
          {items.length > 0 && !query.trim() && (
            <Button
              onPress={() => void emptyTrash()}
              className="-mr-2 shrink-0 rounded-sm px-2 py-2 hover:text-destructive data-focus-visible:outline-2"
            >
              Empty trash
            </Button>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {query.trim()
            ? `Nothing here mentions “${query.trim()}”.`
            : view === 'trash'
              ? 'The trash is empty.'
              : 'Archive finished lists and old notes to keep them out of the way.'}
        </p>
      ) : (
        <Rows items={items} {...context} />
      )}
    </section>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title ?? 'Notes, lists and tasks'}>
      {title && <h2 className="mb-1 text-xs text-muted-foreground">{title}</h2>}
      {children}
    </section>
  )
}

type RowContext = {
  store: Store
  counts: EntryCounts
  spaces: Map<string, SpaceView>
  /** Name the space of shared items, when not already filtered to one space. */
  showSpace: boolean
}

function Rows({ items, ...context }: RowContext & { items: Item[] }) {
  return (
    <ul>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} {...context} />
      ))}
    </ul>
  )
}

/**
 * Titles line up in one column; tasks keep their checkbox in the margin to the left of it, so the
 * page reads like a notebook rather than a table.
 */
function ItemRow({
  store,
  item,
  counts,
  spaces,
  showSpace,
}: RowContext & { item: Item }) {
  const done = item.completed_at !== null
  const space = item.space_id ? spaces.get(item.space_id) : undefined
  const detail = [
    item.deleted_at
      ? `Deleted ${formatShortDate(item.deleted_at)}`
      : item.archived_at
        ? `Archived ${formatShortDate(item.archived_at)}`
        : null,
    showSpace && space && !space.personal ? space.name : null,
    describeItem(item, counts),
  ]
    .filter(Boolean)
    .join(' · ')

  const editable = item.deleted_at === null && (!space || canEdit(space.role))
  const label = itemLabels[item.type]

  // Tasks are finished (or reopened) with a swipe right; notes and lists are archived.
  async function swipeRight() {
    if (item.type === 'task') {
      await store.setItemCompleted(item.id, !done)
      toast(done ? `${item.title} reopened` : `${item.title} done`, {
        action: {
          label: 'Undo',
          onClick: () => void store.setItemCompleted(item.id, done),
        },
      })
      return
    }
    await store.setItemArchived(item.id, true)
    toast(`${label} archived`, {
      action: {
        label: 'Undo',
        onClick: () => void store.setItemArchived(item.id, false),
      },
    })
  }

  async function swipeLeft() {
    await store.trashItem(item.id)
    toast(`${label} moved to the trash`, {
      action: { label: 'Undo', onClick: () => void store.restoreItem(item.id) },
    })
  }

  return (
    <SwipeRow
      enabled={editable && item.archived_at === null}
      right={{
        label: item.type !== 'task' ? 'Archive' : done ? 'Reopen' : 'Done',
        run: swipeRight,
      }}
      left={{ label: 'Delete', run: swipeLeft }}
    >
      {item.type === 'task' && (
        <Checkbox
          className="absolute top-0.5 -left-[2.375rem]"
          isSelected={done}
          isDisabled={!editable}
          onChange={(selected) =>
            void store.setItemCompleted(item.id, selected)
          }
          aria-label={`Done: ${item.title}`}
        />
      )}
      <Link
        to="/items/$itemId"
        params={{ itemId: item.id }}
        // Keeps the filters, so the list beside an open item stays as it was.
        search={true}
        // Found by j and k in the notebook layout.
        data-item-link
        className="group flex min-h-12 flex-col justify-center rounded-sm py-2.5 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <span
          dir="auto"
          className={cn(
            'truncate font-serif text-[1.1875rem] leading-snug decoration-1 underline-offset-4 group-data-[status=active]:underline',
            done && 'text-muted-foreground line-through decoration-1',
          )}
        >
          {item.title}
        </span>
        {detail && (
          <span className="truncate text-sm text-muted-foreground">
            {detail}
          </span>
        )}
      </Link>
    </SwipeRow>
  )
}

type SwipeAction = { label: string; run: () => Promise<void> }

/** How far a row must travel, in pixels, before letting go runs the action. */
const swipeThreshold = 96

/**
 * Touch only: swipe a row right or left to run an action, with Undo in the toast. A shortcut,
 * never the only way: the checkbox and the item page do the same with a mouse or keyboard.
 * Vertical scrolling stays with the browser (`touch-pan-y`), which cancels the gesture. Touch
 * pointers stay with the element they started on, so no pointer capture is needed.
 */
function SwipeRow({
  enabled,
  right,
  left,
  children,
}: {
  enabled: boolean
  right: SwipeAction
  left: SwipeAction
  children: ReactNode
}) {
  const swiped = useRef(false)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Browsers may send no click after a long swipe, so the flag is cleared at the next touch.
    swiped.current = false
    if (!enabled || event.pointerType !== 'touch') return
    const content = event.currentTarget
    const row = content.parentElement as HTMLElement
    const startX = event.clientX
    const startY = event.clientY
    let dx = 0
    let swiping = false

    const move = (moveEvent: globalThis.PointerEvent) => {
      dx = moveEvent.clientX - startX
      if (!swiping) {
        if (Math.abs(moveEvent.clientY - startY) > 10) return end()
        if (Math.abs(dx) < 10) return
        swiping = true
      }
      const past = Math.abs(dx) >= swipeThreshold
      if (past && row.dataset.armed === undefined) tick()
      row.dataset.swipe = dx > 0 ? 'right' : 'left'
      if (past) row.dataset.armed = ''
      else delete row.dataset.armed
      content.style.translate = `${dx}px 0`
    }
    const up = () => {
      if (swiping) {
        // The click that follows lifting the finger must not open the item.
        swiped.current = true
        if (Math.abs(dx) >= swipeThreshold) void (dx > 0 ? right : left).run()
      }
      end()
    }
    const end = () => {
      content.removeEventListener('pointermove', move)
      content.removeEventListener('pointerup', up)
      content.removeEventListener('pointercancel', end)
      content.style.translate = ''
      delete row.dataset.swipe
      delete row.dataset.armed
    }
    content.addEventListener('pointermove', move)
    content.addEventListener('pointerup', up)
    content.addEventListener('pointercancel', end)
  }

  return (
    <li className="group/swipe relative">
      {enabled && (
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 -left-10 hidden items-center justify-between px-3 text-sm text-muted-foreground group-data-armed/swipe:text-foreground group-data-swipe/swipe:flex"
        >
          <span className="invisible group-data-[swipe=right]/swipe:visible">
            {right.label}
          </span>
          <span className="invisible group-data-armed/swipe:text-destructive group-data-[swipe=left]/swipe:visible">
            {left.label}
          </span>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onClickCapture={(event) => {
          if (!swiped.current) return
          swiped.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
        className="relative touch-pan-y bg-background transition-[translate] duration-200 group-data-swipe/swipe:transition-none motion-reduce:transition-none"
      >
        {children}
      </div>
    </li>
  )
}

function describeItem(item: Item, counts: EntryCounts) {
  if (item.type === 'list') {
    const { total = 0, open = 0, upNext = [] } = counts.get(item.id) ?? {}
    if (total === 0) return 'Empty list'
    if (open === 0) return `All ${total} done`
    return `${upNext.join(', ')}${open > upNext.length ? '…' : ''} · ${open} left`
  }
  const firstLine = previewLine(item.body)
  if (item.type === 'task' && !item.completed_at) {
    return [
      item.due_on && describeDue(item.due_on, localDay(new Date())),
      item.status && statusLabel(item.status),
      item.priority > 0 && `${priorities[item.priority].label} priority`,
      firstLine,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return firstLine
}
