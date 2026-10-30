// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { NewItem } from '#/data/schema'
import { localDay, snoozeDays } from '#/lib/dates'
import { store } from '#/test/client'
import { findUndo, renderPage } from '#/test/dom'
import { ItemDetail } from './item-detail'

vi.mock('#/data/client', () => import('#/test/client'))
// Without an account: no spaces, and everything is editable.
vi.mock('#/lib/account', () => ({ useAccount: () => null }))

async function openItem(input: NewItem) {
  const id = await store.createItem(input)
  const view = renderPage(<ItemDetail store={store} itemId={id} />)
  await screen.findByRole('heading', { level: 1, name: input.title })
  return { id, view, item: () => store.items.get(id) }
}

describe('ItemDetail', () => {
  it('saves a new title on Enter and puts the old one back when emptied', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({ type: 'note', title: 'Draft' })
    // The field remounts with each saved title, so it is looked up again after a save.
    const title = () => screen.getByRole('textbox', { name: 'Title' })

    await user.clear(title())
    await user.type(title(), 'Final{Enter}')
    await waitFor(() => expect(item()?.title).toBe('Final'))

    await user.clear(title())
    await user.tab()
    expect(title()).toHaveProperty('value', 'Final')
    expect(item()?.title).toBe('Final')
  })

  it('saves the text shortly after typing stops', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({ type: 'note', title: 'Idea' })

    await user.type(
      screen.getByRole('textbox', { name: 'Note' }),
      'Paint the door',
    )

    await waitFor(() => expect(item()?.body).toBe('Paint the door'))
  })

  it('shows written text as formatted Markdown, and its source to edit', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({
      type: 'note',
      title: 'Trip',
      body: '## Pack\n- **tent**\n<b>raw</b>',
    })

    const note = screen.getByRole('region', { name: 'Note' })
    expect(note.querySelector('h2')?.textContent).toBe('Pack')
    expect(note.querySelector('strong')?.textContent).toBe('tent')
    expect(note.querySelector('b')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Edit note' }))
    const source = screen.getByRole('textbox', { name: 'Note' })
    expect(document.activeElement).toBe(source)
    await user.type(source, '\nstove')
    await user.tab()

    expect(screen.getByRole('region', { name: 'Note' }).textContent).toContain(
      'stove',
    )
    await waitFor(() => expect(item()?.body).toContain('stove'))
  })

  it('saves unsaved text when the page is left or the app is hidden', async () => {
    const user = userEvent.setup()
    const { item, view } = await openItem({ type: 'note', title: 'Idea' })
    const body = screen.getByRole('textbox', { name: 'Note' })

    await user.type(body, 'First')
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    await waitFor(() => expect(item()?.body).toBe('First'))

    await user.type(body, ' and second')
    view.unmount()
    await waitFor(() => expect(item()?.body).toBe('First and second'))
  })

  it('completes a task and sets its priority', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({ type: 'task', title: 'Call the vet' })

    await user.click(screen.getByRole('checkbox', { name: 'Done' }))
    await user.click(screen.getByRole('radio', { name: 'High' }))

    await waitFor(() => expect(item()?.priority).toBe(3))
    expect(item()?.completed_at).not.toBeNull()
  })

  it('moves a repeating task to its next due day, with Undo', async () => {
    const user = userEvent.setup()
    const { id, item } = await openItem({ type: 'task', title: 'Water plants' })
    await store.setItemDue(id, '2099-01-05')

    await user.click(await screen.findByRole('radio', { name: 'Weekly' }))
    await waitFor(() => expect(item()?.repeat).toBe('weekly'))
    await user.click(screen.getByRole('checkbox', { name: 'Done' }))

    await user.click(await findUndo('Water plants: next due 12 January'))
    await waitFor(() => expect(item()?.due_on).toBe('2099-01-05'))
    expect(item()?.completed_at).toBeNull()
  })

  it('archives an item and moves it to the trash with Undo', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({ type: 'list', title: 'Packing' })

    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(item()?.archived_at).not.toBeNull())
    expect(screen.getByText(/· Archived/)).toBeTruthy()

    await user.click(
      screen.getByRole('button', { name: 'Move list to the trash' }),
    )
    await waitFor(() => expect(item()?.deleted_at).not.toBeNull())
    await user.click(await findUndo('List moved to the trash'))
    await waitFor(() => expect(item()?.deleted_at).toBeNull())
  })

  it('snoozes an item from a menu, with Undo, and brings it back', async () => {
    const user = userEvent.setup()
    const { id, item } = await openItem({ type: 'note', title: 'Gift ideas' })
    const tomorrow = snoozeDays(localDay(new Date())).tomorrow

    await user.click(screen.getByRole('button', { name: 'Snooze note' }))
    await user.click(await screen.findByRole('menuitem', { name: /Tomorrow/ }))
    await waitFor(() => expect(item()?.snoozed_until).toBe(tomorrow))
    await user.click(await findUndo(/^Note snoozed until /))
    await waitFor(() => expect(item()?.snoozed_until).toBeNull())

    await store.setItemSnoozed(id, '2099-01-01')
    await user.click(
      await screen.findByRole('button', { name: 'Bring back now' }),
    )
    await waitFor(() => expect(item()?.snoozed_until).toBeNull())
  })

  it('shows a trashed item read-only until it is restored', async () => {
    const user = userEvent.setup()
    const id = await store.createItem({ type: 'note', title: 'Old idea' })
    await store.trashItem(id)
    renderPage(<ItemDetail store={store} itemId={id} />)

    await screen.findByText(/In the trash since/)
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty(
      'readOnly',
      true,
    )

    await user.click(screen.getByRole('button', { name: 'Restore' }))
    await waitFor(() =>
      expect(screen.queryByText(/In the trash since/)).toBeNull(),
    )
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty(
      'readOnly',
      false,
    )
  })

  it('turns a note into a list with the text just typed, and back with Undo', async () => {
    const user = userEvent.setup()
    const { item } = await openItem({ type: 'note', title: 'Packing' })

    // Typed and converted before the debounced save runs.
    await user.type(
      screen.getByRole('textbox', { name: 'Note' }),
      'tent{Enter}stove',
    )
    await user.click(screen.getByRole('button', { name: 'Turn into a list' }))

    await waitFor(() => expect(item()?.type).toBe('list'))
    expect(store.entries.toArray.map((entry) => entry.text).sort()).toEqual([
      'stove',
      'tent',
    ])
    expect(item()?.body).toBe('')

    await user.click(await findUndo('Note turned into a list'))
    await waitFor(() => expect(item()?.type).toBe('note'))
    expect(item()?.body).toBe('tent\nstove')
    expect(store.entries.size).toBe(0)
  })

  it('copies a list as text where the browser cannot share', async () => {
    const user = userEvent.setup()
    await openItem({ type: 'list', title: 'Groceries', entries: ['milk'] })

    await user.click(screen.getByRole('button', { name: 'Copy as text' }))

    await screen.findByText('Copied as text')
    expect(await navigator.clipboard.readText()).toBe('Groceries\n\n- [ ] milk')
  })

  it('says so when the item was deleted elsewhere', async () => {
    const { id } = await openItem({ type: 'note', title: 'Gone soon' })

    await act(() => store.deleteItem(id))

    expect(await screen.findByText('This page was torn out.')).toBeTruthy()
  })
})
