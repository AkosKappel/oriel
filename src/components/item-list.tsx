import { useLiveQuery } from '@tanstack/react-db'
import { Inbox } from 'lucide-react'
import { itemIcons, itemLabels } from '#/components/item-icon'
import type { Store } from '#/data/store'

export function ItemList({ store }: { store: Store }) {
  const { data: items, isLoading } = useLiveQuery({
    query: (q) =>
      q
        .from({ item: store.items })
        .orderBy(({ item }) => item.created_at, 'desc'),
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

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const Icon = itemIcons[item.type]
        return (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <Icon
              aria-label={itemLabels[item.type]}
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="truncate">{item.title}</span>
          </li>
        )
      })}
    </ul>
  )
}
