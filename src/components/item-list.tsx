import { useLiveQuery } from '@tanstack/react-db'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Inbox } from 'lucide-react'
import { Checkbox } from '#/components/checkbox'
import { itemIcons, itemLabels } from '#/components/item-icon'
import { countEntries, organizeItems } from '#/data/organize'
import { type Item, type ItemType, priorities } from '#/data/schema'
import type { Store } from '#/data/store'

const emptyMessages: Record<ItemType | 'all', string> = {
  all: 'Notes, lists and tasks you capture will show up here.',
  note: 'Notes you capture will show up here.',
  list: 'Lists you capture will show up here.',
  task: 'Tasks you capture will show up here.',
}

type EntryCounts = ReturnType<typeof countEntries>

export function ItemList({ store, type }: { store: Store; type?: ItemType }) {
  const { data: items, isLoading } = useLiveQuery({
    query: (q) => q.from({ item: store.items }),
  })
  const { data: entries } = useLiveQuery({
    query: (q) => q.from({ entry: store.entries }),
  })

  if (isLoading) return null

  const { pinned, open, completed } = organizeItems(items, type)
  const counts = countEntries(entries)

  if (pinned.length + open.length + completed.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Inbox aria-hidden className="size-10 text-muted-foreground" />
        <p className="font-medium">Nothing here yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          {emptyMessages[type ?? 'all']}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pinned.length > 0 && (
        <Section title="Pinned">
          <Rows store={store} items={pinned} counts={counts} />
        </Section>
      )}
      {open.length > 0 && (
        <Section title={pinned.length > 0 ? 'Everything else' : undefined}>
          <Rows store={store} items={open} counts={counts} />
        </Section>
      )}
      {completed.length > 0 && (
        <details className="group">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground">
            <ChevronRight
              aria-hidden
              className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            Completed · {completed.length}
          </summary>
          <Rows store={store} items={completed} counts={counts} />
        </details>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title ?? 'Items'}>
      {title && (
        <h2 className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

function Rows({
  store,
  items,
  counts,
}: {
  store: Store
  items: Item[]
  counts: EntryCounts
}) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <ItemRow key={item.id} store={store} item={item} counts={counts} />
      ))}
    </ul>
  )
}

function ItemRow({
  store,
  item,
  counts,
}: {
  store: Store
  item: Item
  counts: EntryCounts
}) {
  const Icon = itemIcons[item.type]
  const done = item.completed_at !== null
  const detail = describe(item, counts)

  return (
    <li className="flex items-center gap-1">
      {item.type === 'task' ? (
        <Checkbox
          className="-ml-3"
          checked={done}
          onChange={(event) =>
            void store.setItemCompleted(item.id, event.target.checked)
          }
          aria-label={`Done: ${item.title}`}
        />
      ) : (
        <span className="-ml-3 grid size-11 shrink-0 place-items-center">
          <Icon
            aria-label={itemLabels[item.type]}
            className="size-4 text-muted-foreground"
          />
        </span>
      )}
      <Link
        to="/items/$itemId"
        params={{ itemId: item.id }}
        className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2"
      >
        <span
          className={`truncate ${done ? 'text-muted-foreground line-through' : ''}`}
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
    const { total = 0, open = 0 } = counts.get(item.id) ?? {}
    if (total === 0) return 'Empty'
    return open === 0 ? `All ${total} done` : `${open} of ${total} left`
  }
  const firstLine = item.body.split('\n', 1)[0]
  if (item.type === 'task' && item.priority > 0 && !item.completed_at) {
    const priority = `${priorities[item.priority].label} priority`
    return firstLine ? `${priority} · ${firstLine}` : priority
  }
  return firstLine
}
