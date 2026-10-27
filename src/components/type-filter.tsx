import { Link } from '@tanstack/react-router'
import { type ItemType, itemTypes } from '#/data/schema'

const labels: Record<ItemType, string> = {
  note: 'Notes',
  list: 'Lists',
  task: 'Tasks',
}

const options = [
  { type: undefined, label: 'All' },
  ...itemTypes.map((type) => ({ type, label: labels[type] })),
]

/** Filter links keep the choice in the URL, so it survives reloads and the back button. */
export function TypeFilter({ active }: { active?: ItemType }) {
  return (
    <nav aria-label="Show" className="-mx-1 flex gap-1 overflow-x-auto">
      {options.map(({ type, label }) => (
        <Link
          key={label}
          to="/"
          search={type ? { type } : {}}
          aria-current={active === type ? 'page' : undefined}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:bg-secondary aria-[current=page]:text-foreground"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
