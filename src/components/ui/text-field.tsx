import {
  TextField as AriaTextField,
  FieldError,
  Input,
  Label,
  type TextFieldProps,
} from 'react-aria-components'

/** A labelled underline field; React Aria ties the label and the error message to the input. */
export function TextField({
  label,
  ...props
}: Omit<TextFieldProps, 'children' | 'className'> & { label: string }) {
  return (
    <AriaTextField {...props} className="group flex flex-col gap-1">
      <Label className="text-sm text-muted-foreground">{label}</Label>
      <Input className="h-11 border-b-[1.5px] border-foreground/25 bg-transparent font-serif text-lg outline-none group-data-invalid:border-destructive focus:border-foreground" />
      <FieldError className="text-xs text-destructive" />
    </AriaTextField>
  )
}
