import { Link } from '@tanstack/react-router'
import { type PointerEvent, type ReactNode, useRef, useState } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { completeTask } from '#/components/complete-task'
import {
  priorityDetail,
  repeatDetail,
  statusLabel,
} from '#/components/item-labels'
import { Checkbox } from '#/components/ui/checkbox'
import {
  assignedTo,
  countEntries,
  type DueFilter,
  itemsInView,
  matchRanges,
  organizeItems,
  previewLine,
  searchItems,
  trashDays,
  type View,
  withDue,
  withStatus,
} from '#/data/organize'
import type { Item, ItemType, TaskStatus } from '#/data/schema'
import type { Store } from '#/data/store'
import { useAccount } from '#/lib/account'
import { describeDue, formatDay, formatShortDate, localDay } from '#/lib/dates'
import { tick } from '#/lib/haptics'
import { canEdit, type SpaceView } from '#/lib/spaces'
import { useRows } from '#/lib/use-rows'
import { cn } from '#/lib/utils'
import { m } from '#/paraglide/messages.js'

type EntryCounts = ReturnType<typeof countEntries>

export function ItemList({
  store,
  type,
  status,
  due,
  mine,
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
  /** With tasks: only open tasks for the signed-in member. */
  mine?: boolean
  /** Show one space only. */
  spaceId?: string
  /** Show only items that contain these words. */
  query?: string
  /** Snoozed, the archive or the trash instead of home. */
  view?: View
  spaces: Map<string, SpaceView>
}) {
  const { data: items, isLoading } = useRows(store.items)
  const { data: entries } = useRows(store.entries)
  const account = useAccount()

  if (isLoading) return null

  const today = localDay(new Date())
  const shown = assignedTo(
    withDue(
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
    ),
    type === 'task' && mine ? account?.userId : undefined,
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
    if (mine && type === 'task' && !query.trim()) {
      return (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {m.empty_mine()}
        </p>
      )
    }
    if (due && type === 'task' && !query.trim()) {
      return (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {due === 'today' ? m.empty_due_today() : m.empty_due_later()}
        </p>
      )
    }
    if (query.trim()) {
      return (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {m.empty_search({ query: query.trim() })}
        </p>
      )
    }
    return (
      <div className="flex flex-1 flex-col justify-center gap-2 pb-16">
        <p className="font-serif text-2xl italic">{m.empty_blank()}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {type ? m.empty_type({ type }) : m.empty_all()}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {pinned.length > 0 && (
        <Section title={m.section_pinned()}>
          <Rows
            store={store}
            items={pinned}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
            query={query}
          />
        </Section>
      )}
      {open.length > 0 && (
        <Section
          title={pinned.length > 0 ? m.section_everything_else() : undefined}
        >
          <Rows
            store={store}
            items={open}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
            query={query}
          />
        </Section>
      )}
      {completed.length > 0 && (
        <details className="group">
          <summary className="flex h-11 w-fit cursor-pointer list-none items-center text-sm text-muted-foreground hover:text-foreground">
            <span className="group-open:hidden">
              {m.show_completed({ count: completed.length })}
            </span>
            <span className="hidden group-open:inline">
              {m.hide_completed()}
            </span>
          </summary>
          <Rows
            store={store}
            items={completed}
            counts={counts}
            spaces={spaces}
            showSpace={!spaceId}
            query={query}
          />
        </details>
      )}
    </div>
  )
}

const viewTitles: Record<View, () => string> = {
  snoozed: m.view_snoozed,
  archive: m.view_archive,
  trash: m.view_trash,
}

const emptyViews: Record<View, () => string> = {
  snoozed: m.empty_snoozed,
  archive: m.empty_archive,
  trash: m.empty_trash,
}

/** Snoozed, the archive and the trash: one list, each row saying when it went there or comes back. */
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
    toast(m.trash_emptied({ count }), {
      action: {
        label: m.undo(),
        onClick: () => void context.store.restore(snapshot),
      },
    })
  }

  return (
    <section aria-labelledby="past-items" className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center justify-between">
        <h2 id="past-items" className="font-serif text-2xl">
          {viewTitles[view]()}
        </h2>
        <Link
          to="/app"
          search={(previous) => ({ ...previous, view: undefined })}
          className="-mr-2 rounded-sm px-2 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
        >
          {m.close()}
        </Link>
      </div>
      {view === 'trash' && (
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>{m.trash_note({ days: trashDays })}</p>
          {items.length > 0 && !query.trim() && (
            <Button
              onPress={() => void emptyTrash()}
              className="-mr-2 shrink-0 rounded-sm px-2 py-2 hover:text-destructive data-focus-visible:outline-2"
            >
              {m.trash_empty_button()}
            </Button>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="pt-6 text-sm text-muted-foreground" role="status">
          {query.trim()
            ? m.empty_search({ query: query.trim() })
            : emptyViews[view]()}
        </p>
      ) : (
        <Rows items={items} query={query} {...context} />
      )}
    </section>
  )
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title ?? m.section_all_items()}>
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
  /** Search words to highlight in titles and previews. */
  query?: string
}

/**
 * Rows render a page at a time: with 2,000 items, rendering every row took 1.6 seconds on a fast
 * machine (backlog S-08). Search and filters still look at everything.
 */
export const rowsPerPage = 100

function Rows({ items, ...context }: RowContext & { items: Item[] }) {
  const [limit, setLimit] = useState(rowsPerPage)
  const list = useRef<HTMLUListElement>(null)
  const hidden = items.length - limit

  // Focus goes to the first new row: the button may disappear, and the place in the list stays.
  function showMore() {
    const first = limit
    setLimit(limit + rowsPerPage)
    requestAnimationFrame(() =>
      list.current?.children[first]?.querySelector('a')?.focus(),
    )
  }

  return (
    <>
      <ul ref={list}>
        {items.slice(0, limit).map((item) => (
          <ItemRow key={item.id} item={item} {...context} />
        ))}
      </ul>
      {hidden > 0 && (
        <Button
          onPress={showMore}
          className="flex h-11 w-fit items-center rounded-sm text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
        >
          {m.show_more({ count: Math.min(hidden, rowsPerPage) })}
        </Button>
      )}
    </>
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
  query = '',
}: RowContext & { item: Item }) {
  const done = item.completed_at !== null
  const space = item.space_id ? spaces.get(item.space_id) : undefined
  const account = useAccount()
  const assignee =
    item.type === 'task' && !done && item.assigned_to
      ? item.assigned_to === account?.userId
        ? m.row_for_you()
        : space?.members.find((member) => member.user_id === item.assigned_to)
            ?.member_name
      : undefined
  const detail = [
    item.deleted_at
      ? m.row_deleted({ date: formatShortDate(item.deleted_at) })
      : item.archived_at
        ? m.row_archived({ date: formatShortDate(item.archived_at) })
        : item.snoozed_until && item.snoozed_until > localDay(new Date())
          ? m.row_back({
              date: formatDay(new Date(`${item.snoozed_until}T12:00:00`)),
            })
          : null,
    showSpace && space && !space.personal ? space.name : null,
    assignee &&
      (item.assigned_to === account?.userId
        ? assignee
        : m.row_for({ name: assignee })),
    describeItem(item, counts),
  ]
    .filter(Boolean)
    .join(' · ')

  const editable = item.deleted_at === null && (!space || canEdit(space.role))

  // Tasks are finished (or reopened) with a swipe right; notes and lists are archived.
  async function swipeRight() {
    if (item.type === 'task') {
      if (await completeTask(store, item, !done)) return
      toast(
        done
          ? m.toast_reopened({ title: item.title })
          : m.toast_done({ title: item.title }),
        {
          action: {
            label: m.undo(),
            onClick: () => void store.setItemCompleted(item.id, done),
          },
        },
      )
      return
    }
    await store.setItemArchived(item.id, true)
    toast(m.toast_archived({ type: item.type }), {
      action: {
        label: m.undo(),
        onClick: () => void store.setItemArchived(item.id, false),
      },
    })
  }

  async function swipeLeft() {
    await store.trashItem(item.id)
    toast(m.toast_trashed({ type: item.type }), {
      action: {
        label: m.undo(),
        onClick: () => void store.restoreItem(item.id),
      },
    })
  }

  return (
    <SwipeRow
      enabled={editable && item.archived_at === null}
      right={{
        label:
          item.type !== 'task'
            ? m.swipe_archive()
            : done
              ? m.swipe_reopen()
              : m.swipe_done(),
        run: swipeRight,
      }}
      left={{ label: m.swipe_delete(), run: swipeLeft }}
    >
      {item.type === 'task' && (
        <Checkbox
          className="absolute top-0.5 -left-[2.375rem]"
          isSelected={done}
          isDisabled={!editable}
          onChange={(selected) => void completeTask(store, item, selected)}
          aria-label={m.check_task({ title: item.title })}
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
          <Highlight text={item.title} query={query} />
        </span>
        {detail && (
          <span className="truncate text-sm text-muted-foreground">
            <Highlight text={detail} query={query} />
          </span>
        )}
      </Link>
    </SwipeRow>
  )
}

/** Text with the words of a search marked. */
function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchRanges(text, query)
  if (ranges.length === 0) return text
  const parts: ReactNode[] = []
  let at = 0
  for (const [start, end] of ranges) {
    parts.push(text.slice(at, start))
    parts.push(
      <mark
        key={start}
        className="bg-transparent text-foreground underline decoration-primary decoration-2 underline-offset-2"
      >
        {text.slice(start, end)}
      </mark>,
    )
    at = end
  }
  parts.push(text.slice(at))
  return parts
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
    if (total === 0) return m.list_empty()
    if (open === 0) return m.list_all_done({ count: total })
    return `${upNext.join(', ')}${open > upNext.length ? '…' : ''} · ${m.list_left({ count: open })}`
  }
  const firstLine = previewLine(item.body)
  if (item.type === 'task' && !item.completed_at) {
    return [
      item.due_on && describeDue(item.due_on, localDay(new Date())),
      item.repeat && repeatDetail(item.repeat),
      item.status && statusLabel(item.status),
      item.priority > 0 && priorityDetail(item.priority),
      firstLine,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return firstLine
}
