// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sortEntries } from '#/data/organize'
import { store } from '#/test/client'
import { findUndo, renderPage } from '#/test/dom'
import { EntryList } from './entry-list'

vi.mock('#/data/client', () => import('#/test/client'))

const texts = () =>
  sortEntries(store.entries.toArray).map((entry) => entry.text)
const checked = () =>
  store.entries.toArray.filter((entry) => entry.completed_at).length

async function renderList(entries: string[], readOnly = false) {
  const itemId = await store.createItem({
    type: 'list',
    title: 'Groceries',
    entries,
  })
  renderPage(<EntryList store={store} itemId={itemId} readOnly={readOnly} />)
  await screen.findByText(
    entries.length
      ? `${entries.length} of ${entries.length} left`
      : 'No items yet',
  )
  return itemId
}

describe('EntryList', () => {
  it('adds an entry on Enter, and one entry per line when a list is pasted', async () => {
    const user = userEvent.setup()
    await renderList(['Milk'])
    const add = screen.getByRole('combobox', { name: 'Add an item' })

    await user.type(add, 'Eggs{Enter}')
    await user.click(add)
    await user.paste('- Bread\n- Butter\n\n')

    await waitFor(() =>
      expect(texts()).toEqual(['Milk', 'Eggs', 'Bread', 'Butter']),
    )
    expect(add).toHaveProperty('value', '')
  })

  it('renames an entry when it loses focus, and Escape puts the old text back', async () => {
    const user = userEvent.setup()
    await renderList(['Milk', 'Eggs'])
    const [milk, eggs] = screen.getAllByRole('textbox', { name: 'Item text' })

    await user.clear(milk)
    await user.type(milk, 'Oat milk')
    await user.tab()
    await user.clear(eggs)
    await user.type(eggs, 'Bacon{Escape}')

    await waitFor(() => expect(texts()).toEqual(['Oat milk', 'Eggs']))
    expect(eggs).toHaveProperty('value', 'Eggs')
  })

  it('removes an entry whose text is emptied, with Undo', async () => {
    const user = userEvent.setup()
    await renderList(['Milk', 'Eggs'])
    const [milk] = screen.getAllByRole('textbox', { name: 'Item text' })

    await user.clear(milk)
    await user.tab()
    await waitFor(() => expect(texts()).toEqual(['Eggs']))

    await user.click(await findUndo('Removed Milk'))
    await waitFor(() => expect(texts()).toEqual(['Milk', 'Eggs']))
  })

  it('clears checked entries and unchecks all, each with Undo', async () => {
    const user = userEvent.setup()
    await renderList(['Milk', 'Eggs', 'Bread'])
    await user.click(screen.getByRole('checkbox', { name: 'Check Milk' }))
    await user.click(screen.getByRole('checkbox', { name: 'Check Eggs' }))
    await screen.findByText('1 of 3 left')

    await user.click(screen.getByRole('button', { name: 'Uncheck all' }))
    await screen.findByText('3 of 3 left')
    await user.click(await findUndo('Unchecked 2'))
    await waitFor(() => expect(checked()).toBe(2))

    await user.click(screen.getByRole('button', { name: 'Clear checked' }))
    await waitFor(() => expect(texts()).toEqual(['Bread']))
    await user.click(await findUndo('Cleared 2 checked'))
    await waitFor(() => expect(texts()).toHaveLength(3))
  })

  it('offers no changes when read-only', async () => {
    await renderList(['Milk'], true)

    expect(screen.queryByRole('combobox', { name: 'Add an item' })).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Check Milk' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('textbox', { name: 'Item text' })).toHaveProperty(
      'readOnly',
      true,
    )
  })
})

describe('EntryList suggestions', () => {
  it('suggests entries from other lists that this list does not have open', async () => {
    await store.createItem({
      type: 'list',
      title: 'Last week',
      entries: ['Oat milk', 'Eggs'],
    })
    await renderList(['Eggs'])

    const add = screen.getByRole('combobox', { name: 'Add an item' })
    const listId = add.getAttribute('list')
    const options = [
      ...document.querySelectorAll(`[id="${listId}"] option`),
    ].map((option) => option.getAttribute('value'))
    expect(options).toEqual(['Oat milk'])
  })
})
