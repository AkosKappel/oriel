import { count, useLiveQuery } from '@tanstack/react-db'
import { Inbox } from 'lucide-react'
import { itemIcons, itemLabels } from '#/components/item-icon'
import type { Item } from '#/data/schema'
import type { Store } from '#/data/store'

export function ItemList({ store }: { store: Store }) {
  const { data: items, isLoading } = useLiveQuery({
    query: (q) =>
      q
        .from({ item: store.items })
        .orderBy(({ item }) => item.created_at, 'desc'),
  })
  const { data: entryCounts } = useLiveQuery({
    query: (q) =>
      q
        .from({ entry: store.entries })
        .groupBy(({ entry }) => entry.item_id)
        .select(({ entry }) => ({
          itemId: entry.item_id,
          total: count(entry.id),
        })),
  })

  if (isLoading) return null

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Inbox aria-hidden className="size-10 text-muted-foreground" />
        <p className="font-medium">Nothing here yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Notes, lists and tasks you capture will show up here.
        </p>
      </div>
    )
  }

  const totals = new Map(entryCounts.map((row) => [row.itemId, row.total]))

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const Icon = itemIcons[item.type]
        const detail = describe(item, totals.get(item.id) ?? 0)
        return (
          <li key={item.id} className="flex gap-3 py-3">
            <Icon
              aria-label={itemLabels[item.type]}
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <div className="min-w-0">
              <p className="truncate">{item.title}</p>
              {detail && (
                <p className="truncate text-sm text-muted-foreground">
                  {detail}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function describe(item: Item, entryCount: number) {
  if (item.type === 'list') {
    return entryCount === 1 ? '1 item' : `${entryCount} items`
  }
  return item.body.split('\n', 1)[0]
}
