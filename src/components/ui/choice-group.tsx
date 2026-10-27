import { Label, Radio, RadioGroup } from 'react-aria-components'
import { cn } from '#/lib/utils'

type Choice<T extends string> = { value: T; label: string }

/**
 * A row of words to pick from (arrow keys move between them), the selected one underlined. Used
 * where a set of pill buttons would look like a form.
 */
export function ChoiceGroup<T extends string>({
  label,
  showLabel = false,
  choices,
  value,
  onChange,
  isDisabled,
  className,
}: {
  label: string
  showLabel?: boolean
  choices: readonly Choice<T>[]
  value: T
  onChange: (value: T) => void
  isDisabled?: boolean
  className?: string
}) {
  return (
    <RadioGroup
      aria-label={showLabel ? undefined : label}
      orientation="horizontal"
      value={value}
      isDisabled={isDisabled}
      onChange={(next) => onChange(next as T)}
      className={cn('flex flex-wrap items-center gap-x-4 text-sm', className)}
    >
      {showLabel && <Label className="text-muted-foreground">{label}</Label>}
      {choices.map((choice) => (
        <Radio
          key={choice.value}
          value={choice.value}
          className="cursor-pointer py-2 text-muted-foreground underline-offset-[6px] transition-colors hover:text-foreground data-disabled:cursor-default data-disabled:hover:text-muted-foreground data-focus-visible:rounded-sm data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-selected:text-foreground data-selected:underline data-selected:decoration-[1.5px] motion-reduce:transition-none"
        >
          {choice.label}
        </Radio>
      ))}
    </RadioGroup>
  )
}
