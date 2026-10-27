import { Link } from '@tanstack/react-router'
import { type ItemType, itemTypes } from '#/data/schema'

const labels: Record<ItemType, string> = {
  note: 'Notes',
  list: 'Lists',
  task: 'Tasks',
}

const options = [
  { type: undefined, label: 'Everything' },
  ...itemTypes.map((type) => ({ type, label: labels[type] })),
]

/** Filter links keep the choice in the URL, so it survives reloads and the back button. */
export function TypeFilter({ active }: { active?: ItemType }) {
  return (
    <nav aria-label="Show" className="flex gap-x-4 text-sm">
      {options.map(({ type, label }) => (
        <Link
          key={label}
          to="/"
          search={type ? { type } : {}}
          aria-current={active === type ? 'page' : undefined}
          className="py-2 text-muted-foreground underline-offset-[6px] hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-[1.5px]"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
