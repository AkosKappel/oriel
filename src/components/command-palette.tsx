import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components'
import { itemLabels } from '#/components/item-labels'
import { fold, itemsInView, searchItems } from '#/data/organize'
import type { ItemType } from '#/data/schema'
import type { Store } from '#/data/store'
import { useAccount } from '#/lib/account'
import { useRows } from '#/lib/use-rows'

type Command = { id: string; label: string; run: () => void }

const itemLimit = 20
const recentLimit = 5

/** The capture field, once the page that holds it has rendered. */
function focusCapture() {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLTextAreaElement>('form[aria-label="Capture"] textarea')
      ?.focus(),
  )
}

/**
 * Opened with Ctrl+K (⌘K on a Mac) on home and the item page, loaded on first use: jump to any note, list or task by typing part of
 * it, or run a command (new item, filters, archive, settings) without the mouse. Matches like
 * search, ignoring case and accents; with nothing typed it offers the most recently changed items.
 */
export function CommandPalette({
  store,
  isOpen,
  onOpenChange: setOpen,
}: {
  store: Store
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const account = useAccount()
  const { data: items } = useRows(store.items)
  const { data: entries } = useRows(store.entries)

  const newItem = (type: ItemType) => () => {
    void navigate({ to: '/', search: { type } }).then(focusCapture)
  }
  const show = (search: Record<string, string>) => () => {
    void navigate({ to: '/', search })
  }
  const commands: Command[] = [
    { id: 'new-note', label: 'New note', run: newItem('note') },
    { id: 'new-list', label: 'New list', run: newItem('list') },
    { id: 'new-task', label: 'New task', run: newItem('task') },
    { id: 'everything', label: 'Show everything', run: show({}) },
    { id: 'notes', label: 'Show notes', run: show({ type: 'note' }) },
    { id: 'lists', label: 'Show lists', run: show({ type: 'list' }) },
    { id: 'tasks', label: 'Show tasks', run: show({ type: 'task' }) },
    {
      id: 'today',
      label: 'Tasks due today',
      run: show({ type: 'task', due: 'today' }),
    },
    {
      id: 'upcoming',
      label: 'Upcoming tasks',
      run: show({ type: 'task', due: 'upcoming' }),
    },
    { id: 'archive', label: 'Archive', run: show({ view: 'archive' }) },
    { id: 'trash', label: 'Trash', run: show({ view: 'trash' }) },
    {
      id: 'settings',
      label: 'Settings',
      run: () => void navigate({ to: '/settings' }),
    },
    account
      ? {
          id: 'account',
          label: 'Account',
          run: () => void navigate({ to: '/account' }),
        }
      : {
          id: 'sign-in',
          label: 'Sign in',
          run: () => void navigate({ to: '/sign-in' }),
        },
  ]

  const words = fold(query).trim()
  const matchingCommands = commands.filter((command) =>
    fold(command.label).includes(words),
  )
  const inView = itemsInView(items)
  const matchingItems = words
    ? searchItems(inView, entries, query).slice(0, itemLimit)
    : [...inView]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, recentLimit)

  function run(key: string) {
    setOpen(false)
    setQuery('')
    const command = commands.find((candidate) => candidate.id === key)
    if (command) command.run()
    else void navigate({ to: '/items/$itemId', params: { itemId: key } })
  }

  const itemClass =
    'flex min-h-11 cursor-default items-center justify-between gap-4 rounded-sm px-3 outline-none data-focused:bg-wash'

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        setOpen(open)
        if (!open) setQuery('')
      }}
      isDismissable
      className="fixed inset-0 z-50 bg-foreground/20 p-4"
    >
      <Modal className="mx-auto mt-[12vh] w-full max-w-lg rounded-md bg-background shadow-lg">
        <Dialog aria-label="Go to or run" className="outline-none">
          <Autocomplete inputValue={query} onInputChange={setQuery}>
            <SearchField
              aria-label="Find an item or a command"
              autoFocus
              className="border-b border-rule px-4"
            >
              <Input
                placeholder="Find an item or a command"
                className="h-14 w-full bg-transparent font-serif text-lg outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
              />
            </SearchField>
            <Menu
              aria-label="Results"
              onAction={(key) => run(String(key))}
              renderEmptyState={() => (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  Nothing matches “{query.trim()}”.
                </p>
              )}
              className="max-h-[60vh] overflow-y-auto p-2 outline-none"
            >
              {matchingItems.length > 0 && (
                <MenuSection>
                  <Header className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                    {words ? 'Notes, lists and tasks' : 'Recently changed'}
                  </Header>
                  {matchingItems.map((item) => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      textValue={item.title}
                      className={itemClass}
                    >
                      <span dir="auto" className="truncate font-serif text-lg">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {itemLabels[item.type]}
                      </span>
                    </MenuItem>
                  ))}
                </MenuSection>
              )}
              {matchingCommands.length > 0 && (
                <MenuSection>
                  <Header className="px-3 pt-2 pb-1 text-xs text-muted-foreground">
                    Commands
                  </Header>
                  {matchingCommands.map((command) => (
                    <MenuItem
                      key={command.id}
                      id={command.id}
                      className={`${itemClass} text-sm`}
                    >
                      {command.label}
                    </MenuItem>
                  ))}
                </MenuSection>
              )}
            </Menu>
          </Autocomplete>
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
