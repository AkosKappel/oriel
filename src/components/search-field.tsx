import { useNavigate } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useState } from 'react'
import {
  SearchField as AriaSearchField,
  Button,
  Input,
} from 'react-aria-components'
import { m } from '#/paraglide/messages.js'

/**
 * Searches everything on this device as you type, so it works offline. The query lives in the URL
 * like the filters; typing replaces the history entry instead of adding one per letter.
 */
export function SearchField({ query = '' }: { query?: string }) {
  const navigate = useNavigate()
  const [text, setText] = useState(query)

  function change(value: string) {
    setText(value)
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, q: value || undefined }),
      replace: true,
    })
  }

  return (
    <AriaSearchField
      aria-label={m.search()}
      value={text}
      onChange={change}
      className="group relative flex items-center"
    >
      <Search
        aria-hidden
        className="absolute -left-[1.875rem] size-4 text-muted-foreground"
      />
      <Input
        placeholder={m.search()}
        className="h-11 min-w-0 flex-1 bg-transparent font-serif text-lg outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      <Button className="-mr-3 grid size-11 place-items-center rounded-sm text-muted-foreground group-data-empty:hidden hover:text-foreground data-focus-visible:outline-2">
        <X aria-hidden className="size-4" />
      </Button>
    </AriaSearchField>
  )
}
