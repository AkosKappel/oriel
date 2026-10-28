import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { Checkbox } from '#/components/ui/checkbox'
import {
  countEntries,
  itemsInView,
  organizeItems,
  searchItems,
  trashDays,
  type View,
} from '#/data/organize'
import { type Item, type ItemType, priorities } from '#/data/schema'
import type { Store } from '#/data/store'
import { formatShortDate } from '#/lib/dates'
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
  spaceId,
  query = '',
  view,
  spaces,
}: {
  store: Store
  type?: ItemType
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

  const shown = searchItems(
    itemsInView(
      spaceId ? items.filter((item) => item.space_id === spaceId) : items,
      view,
    ),
    entries,
    query,
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

  return (
    <li className="relative">
      {item.type === 'task' && (
        <Checkbox
          className="absolute top-0.5 -left-[2.375rem]"
          isSelected={done}
          isDisabled={
            item.deleted_at !== null || (space && !canEdit(space.role))
          }
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
  const firstLine = item.body.split('\n', 1)[0]
  if (item.type === 'task' && item.priority > 0 && !item.completed_at) {
    const priority = `${priorities[item.priority].label} priority`
    return firstLine ? `${priority} · ${firstLine}` : priority
  }
  return firstLine
}
