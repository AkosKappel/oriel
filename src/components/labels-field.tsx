import { Link } from '@tanstack/react-router'
import { X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { Button } from 'react-aria-components'
import {
  cleanLabel,
  labelLength,
  labelLimit,
  labelsInUse,
  readLabels,
} from '#/data/labels'
import { fold } from '#/data/organize'
import type { Item } from '#/data/schema'
import type { Store } from '#/data/store'
import { useRows } from '#/lib/use-rows'
import { m } from '#/paraglide/messages.js'

/**
 * An item's labels: each opens home filtered to it, and can be removed. New ones are typed, with
 * the labels used elsewhere offered as suggestions; a comma adds several at once.
 */
export function LabelsField({
  store,
  item,
  readOnly,
}: {
  store: Store
  item: Item
  readOnly: boolean
}) {
  const [text, setText] = useState('')
  const headingId = useId()
  const suggestionsId = useId()
  const { data: items } = useRows(store.items)
  const labels = readLabels(item.labels)
  const own = new Set(labels.map(fold))
  const suggestions = labelsInUse(items.map((row) => row.labels)).filter(
    (label) => !own.has(fold(label)),
  )

  if (readOnly && labels.length === 0) return null

  function add(event: FormEvent) {
    event.preventDefault()
    const added = text.split(',').map(cleanLabel).filter(Boolean)
    if (added.length === 0) return
    void store.setItemLabels(item.id, [...labels, ...added])
    setText('')
  }

  return (
    <div className="mb-2 flex min-h-11 flex-wrap items-center gap-x-4 text-sm">
      <span id={headingId} className="text-muted-foreground">
        {m.field_labels()}
      </span>
      {labels.length > 0 && (
        <ul aria-labelledby={headingId} className="flex flex-wrap gap-x-3">
          {labels.map((label) => (
            <li key={label} className="flex items-center">
              <Link
                to="/app"
                search={{ label }}
                className="rounded-sm py-2 underline-offset-4 hover:underline focus-visible:outline-2"
              >
                #{label}
              </Link>
              {!readOnly && (
                <Button
                  aria-label={m.label_remove({ label })}
                  onPress={() =>
                    void store.setItemLabels(
                      item.id,
                      labels.filter((other) => other !== label),
                    )
                  }
                  className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2 print:hidden"
                >
                  <X aria-hidden className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && labels.length < labelLimit && (
        <form onSubmit={add} className="print:hidden">
          <input
            aria-label={m.label_add()}
            placeholder={m.label_add()}
            value={text}
            onChange={(event) => setText(event.target.value)}
            list={suggestionsId}
            // Room for several labels separated by commas.
            maxLength={labelLength * labelLimit}
            enterKeyHint="done"
            className="min-h-11 w-36 bg-transparent outline-none placeholder:text-faint focus-visible:rounded-sm focus-visible:outline-2"
          />
          <datalist id={suggestionsId}>
            {suggestions.map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
        </form>
      )}
    </div>
  )
}
