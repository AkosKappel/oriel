import { Check } from 'lucide-react'
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps,
} from 'react-aria-components'
import { cn } from '#/lib/utils'

/**
 * A thin ring that fills in when checked, like ticking a line in a notebook. React Aria handles
 * keyboard, touch and screen readers; the label is a 44 px square so it is easy to hit.
 */
export function Checkbox({
  className,
  ...props
}: Omit<CheckboxProps, 'className' | 'children'> & { className?: string }) {
  return (
    <AriaCheckbox
      {...props}
      className={cn(
        'group grid size-11 shrink-0 cursor-pointer place-items-center data-disabled:cursor-default',
        className,
      )}
    >
      <span className="grid size-[1.125rem] place-items-center rounded-full border-[1.5px] border-faint transition-[color,background-color,border-color,scale] group-hover:border-muted-foreground group-data-disabled:opacity-50 group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-pressed:scale-90 group-data-selected:border-primary group-data-selected:bg-primary motion-reduce:transition-none">
        <Check
          aria-hidden
          strokeWidth={3}
          className="size-2.5 scale-50 text-primary-foreground opacity-0 transition-[opacity,scale] duration-200 group-data-selected:scale-100 group-data-selected:opacity-100 motion-reduce:transition-none"
        />
      </span>
    </AriaCheckbox>
  )
}
