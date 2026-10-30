import { Link } from '@tanstack/react-router'
import { itemsLabel, statusLabel } from '#/components/item-labels'
import type { DueFilter } from '#/data/organize'
import {
  type ItemType,
  itemTypes,
  type TaskStatus,
  taskStatuses,
} from '#/data/schema'
import type { SpaceView } from '#/lib/spaces'
import { m } from '#/paraglide/messages.js'

const typeOptions = () => [
  { type: undefined, label: m.nav_everything() },
  ...itemTypes.map((type) => ({ type, label: itemsLabel(type) })),
]

// The router marks a link active when its search is part of the current one, and a filter set to
// undefined would match every page. Undefined has to match undefined instead.
const activeOptions = { explicitUndefined: true }

const linkClass =
  'shrink-0 py-2 text-muted-foreground underline-offset-[6px] hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-[1.5px]'

/** Filters live in the URL, so they survive reloads and the back button; each keeps the other. */
export function TypeFilter({ active }: { active?: ItemType }) {
  return (
    <nav aria-label={m.filter_show()} className="flex gap-x-4 text-sm">
      {typeOptions().map(({ type, label }) => (
        <Link
          key={label}
          to="/app"
          // Task filters mean nothing for notes or lists.
          search={(previous) => ({
            ...previous,
            type,
            status: undefined,
            due: undefined,
            mine: undefined,
          })}
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

const taskOptions = (): {
  status?: TaskStatus
  due?: DueFilter
  mine?: true
  label: string
}[] => [
  { label: m.filter_all_tasks() },
  { mine: true, label: m.filter_for_me() },
  { due: 'today', label: m.filter_today() },
  { due: 'upcoming', label: m.filter_upcoming() },
  ...taskStatuses.map(({ value }) => ({
    status: value,
    label: statusLabel(value),
  })),
]

/**
 * Shown with tasks: all of them, the open ones for me (once a space is shared), due by today or
 * later, or in one state.
 */
export function TaskFilter({
  status,
  due,
  mine,
  showMine,
}: {
  status?: TaskStatus
  due?: DueFilter
  mine?: boolean
  showMine: boolean
}) {
  return (
    <nav
      aria-label={m.filter_tasks()}
      className="-mx-1 flex gap-x-4 overflow-x-auto px-1 text-sm"
    >
      {taskOptions()
        .filter((option) => showMine || !option.mine)
        .map((option) => (
          <Link
            key={option.label}
            to="/app"
            // One task filter at a time: picking one clears the other.
            search={(previous) => ({
              ...previous,
              status: option.status,
              due: option.due,
              mine: option.mine,
            })}
            aria-current={
              status === option.status &&
              due === option.due &&
              Boolean(mine) === Boolean(option.mine)
                ? 'page'
                : undefined
            }
            activeOptions={activeOptions}
            className={linkClass}
          >
            {option.label}
          </Link>
        ))}
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
      aria-label={m.filter_space()}
      className="-mx-1 flex gap-x-4 overflow-x-auto px-1 text-sm"
    >
      <Link
        to="/app"
        search={(previous) => ({ ...previous, space: undefined })}
        aria-current={active ? undefined : 'page'}
        activeOptions={activeOptions}
        className={linkClass}
      >
        {m.filter_all_spaces()}
      </Link>
      {spaces.map((space) => (
        <Link
          key={space.id}
          to="/app"
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
