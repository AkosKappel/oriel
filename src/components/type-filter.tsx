import { Link } from '@tanstack/react-router'
import {
  type ItemType,
  itemTypes,
  type TaskStatus,
  taskStatuses,
} from '#/data/schema'
import type { SpaceView } from '#/lib/spaces'

const labels: Record<ItemType, string> = {
  note: 'Notes',
  list: 'Lists',
  task: 'Tasks',
}

const typeOptions = [
  { type: undefined, label: 'Everything' },
  ...itemTypes.map((type) => ({ type, label: labels[type] })),
]

// The router marks a link active when its search is part of the current one, and a filter set to
// undefined would match every page. Undefined has to match undefined instead.
const activeOptions = { explicitUndefined: true }

const linkClass =
  'shrink-0 py-2 text-muted-foreground underline-offset-[6px] hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-[1.5px]'

/** Filters live in the URL, so they survive reloads and the back button; each keeps the other. */
export function TypeFilter({ active }: { active?: ItemType }) {
  return (
    <nav aria-label="Show" className="flex gap-x-4 text-sm">
      {typeOptions.map(({ type, label }) => (
        <Link
          key={label}
          to="/"
          // A task status means nothing for notes or lists.
          search={(previous) => ({ ...previous, type, status: undefined })}
          aria-current={active === type ? 'page' : undefined}
          activeOptions={activeOptions}
          className={linkClass}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

/** Shown with tasks: all of them, or the open ones in one state. */
export function StatusFilter({ active }: { active?: TaskStatus }) {
  return (
    <nav aria-label="Task status" className="flex gap-x-4 text-sm">
      {[{ value: undefined, label: 'All tasks' }, ...taskStatuses].map(
        ({ value, label }) => (
          <Link
            key={label}
            to="/"
            search={(previous) => ({ ...previous, status: value })}
            aria-current={active === value ? 'page' : undefined}
            activeOptions={activeOptions}
            className={linkClass}
          >
            {label}
          </Link>
        ),
      )}
    </nav>
  )
}

/** Shown once there is more than one space: everything, or one space at a time. */
export function SpaceFilter({
  spaces,
  active,
}: {
  spaces: SpaceView[]
  active?: string
}) {
  return (
    <nav
      aria-label="Space"
      className="-mx-1 flex gap-x-4 overflow-x-auto px-1 text-sm"
    >
      <Link
        to="/"
        search={(previous) => ({ ...previous, space: undefined })}
        aria-current={active ? undefined : 'page'}
        activeOptions={activeOptions}
        className={linkClass}
      >
        All spaces
      </Link>
      {spaces.map((space) => (
        <Link
          key={space.id}
          to="/"
          search={(previous) => ({ ...previous, space: space.id })}
          aria-current={active === space.id ? 'page' : undefined}
          activeOptions={activeOptions}
          className={linkClass}
        >
          {space.name}
        </Link>
      ))}
    </nav>
  )
}
