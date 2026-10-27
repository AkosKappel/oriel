import { useLiveQuery } from '@tanstack/react-db'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Checkbox } from '#/components/ui/checkbox'
import { countEntries, organizeItems } from '#/data/organize'
import { type Item, type ItemType, priorities } from '#/data/schema'
import type { Store } from '#/data/store'
import { canEdit, type SpaceView } from '#/lib/spaces'
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
  spaces,
}: {
  store: Store
  type?: ItemType
  /** Show one space only. */
  spaceId?: string
  spaces: Map<string, SpaceView>
}) {
  const { data: items, isLoading } = useLiveQuery({
    query: (q) => q.from({ item: store.items }),
  })
  const { data: entries } = useLiveQuery({
    query: (q) => q.from({ entry: store.entries }),
  })

  if (isLoading) return null

  const { pinned, open, completed } = organizeItems(
    spaceId ? items.filter((item) => item.space_id === spaceId) : items,
    type,
  )
  const counts = countEntries(entries)

  if (pinned.length + open.length + completed.length === 0) {
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

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title ?? 'Items'}>
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
    showSpace && space && !space.personal ? space.name : null,
    describe(item, counts),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="relative">
      {item.type === 'task' && (
        <Checkbox
          className="absolute top-0.5 -left-[2.375rem]"
          isSelected={done}
          isDisabled={space && !canEdit(space.role)}
          onChange={(selected) =>
            void store.setItemCompleted(item.id, selected)
          }
          aria-label={`Done: ${item.title}`}
        />
      )}
      <Link
        to="/items/$itemId"
        params={{ itemId: item.id }}
        className="flex min-h-12 flex-col justify-center rounded-sm py-2.5 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <span
          className={cn(
            'truncate font-serif text-[1.1875rem] leading-snug',
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

function describe(item: Item, counts: EntryCounts) {
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
