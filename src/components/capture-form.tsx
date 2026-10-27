import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { itemIcons, itemLabels } from '#/components/item-icon'
import { type ItemType, itemTypes, titleSchema } from '#/data/schema'
import type { Store } from '#/data/store'

export function CaptureForm({ store }: { store: Store }) {
  const [type, setType] = useState<ItemType>('note')
  const [title, setTitle] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!titleSchema.safeParse(title).success) return
    void store.createItem({ type, title })
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <fieldset className="flex gap-1">
        <legend className="sr-only">Type</legend>
        {itemTypes.map((option) => {
          const Icon = itemIcons[option]
          return (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground has-checked:bg-secondary has-checked:text-foreground has-focus-visible:outline-2"
            >
              <input
                type="radio"
                name="type"
                value={option}
                checked={type === option}
                onChange={() => setType(option)}
                className="sr-only"
              />
              <Icon aria-hidden className="size-4" />
              {itemLabels[option]}
            </label>
          )
        })}
      </fieldset>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`New ${itemLabels[type].toLowerCase()}`}
          aria-label="Title"
          maxLength={200}
          className="h-11 min-w-0 flex-1 rounded-lg border bg-card px-3 placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Add"
          className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"
        >
          <Plus aria-hidden className="size-5" />
        </button>
      </div>
    </form>
  )
}
