import { Check } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '#/lib/utils'

/**
 * Round native checkbox: keyboard, form and screen reader behavior come from the input itself.
 * The label around it makes the whole 44 px square tappable.
 */
export function Checkbox({ className, ...props }: ComponentProps<'input'>) {
  return (
    <label
      className={cn(
        'grid size-11 shrink-0 cursor-pointer place-items-center',
        className,
      )}
    >
      <span className="relative grid size-5">
        <input
          type="checkbox"
          className="peer size-full cursor-pointer appearance-none rounded-full border-2 border-muted-foreground/50 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          {...props}
        />
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100"
        />
      </span>
    </label>
  )
}
