// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { store } from '#/test/client'
import { findUndo, renderPage } from '#/test/dom'
import { ItemList, rowsPerPage } from './item-list'

vi.mock('#/data/client', () => import('#/test/client'))

/** A finger dragged sideways across a row, in steps like a real touch. */
function swipe(row: HTMLElement, dx: number) {
  const at = (x: number) => ({
    pointerType: 'touch',
    pointerId: 1,
    clientX: x,
    clientY: 100,
  })
  fireEvent.pointerDown(row, at(200))
  for (let step = 1; step <= 5; step++)
    fireEvent.pointerMove(row, at(200 + (dx * step) / 5))
  fireEvent.pointerUp(row, at(200 + dx))
}

async function renderList(type: 'task' | 'note', title: string) {
  const id = await store.createItem({ type, title })
  renderPage(<ItemList store={store} spaces={new Map()} />)
  return { id, row: await screen.findByRole('link', { name: title }) }
}

describe('ItemList swipes', () => {
  it('finishes a task on a swipe right, with Undo', async () => {
    const user = userEvent.setup()
    const { id, row } = await renderList('task', 'Call the vet')

    swipe(row, 150)

    await waitFor(() =>
      expect(store.items.get(id)?.completed_at).not.toBeNull(),
    )
    await user.click(await findUndo('Call the vet done'))
    await waitFor(() => expect(store.items.get(id)?.completed_at).toBeNull())
  })

  it('moves an item to the trash on a swipe left', async () => {
    const { id, row } = await renderList('note', 'Old idea')

    swipe(row, -150)

    await waitFor(() => expect(store.items.get(id)?.deleted_at).not.toBeNull())
    expect(await findUndo('Note moved to the trash')).toBeTruthy()
  })

  it('does nothing on a short swipe or with a mouse', async () => {
    const { id, row } = await renderList('note', 'Keep me')

    swipe(row, -40)
    fireEvent.pointerDown(row, { pointerType: 'mouse', clientX: 200 })
    fireEvent.pointerMove(row, { pointerType: 'mouse', clientX: 0 })
    fireEvent.pointerUp(row, { pointerType: 'mouse', clientX: 0 })

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(store.items.get(id)).toMatchObject({
      deleted_at: null,
      archived_at: null,
    })
  })
})

describe('ItemList pages', () => {
  it('shows a page of rows and the rest on request', async () => {
    const user = userEvent.setup()
    await store.importItems(
      Array.from({ length: rowsPerPage + 5 }, (_, n) => ({
        id: crypto.randomUUID(),
        space_id: null,
        created_by: null,
        type: 'note' as const,
        title: `Note ${n + 1}`,
        body: '',
        completed_at: null,
        completed_by: null,
        pinned_at: null,
        priority: 0 as const,
        status: null,
        due_on: null,
        archived_at: null,
        deleted_at: null,
        deleted_by: null,
        created_at: new Date(Date.now() - n * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        entries: [],
      })),
    )
    renderPage(<ItemList store={store} spaces={new Map()} />)

    await screen.findByRole('link', { name: 'Note 1' })
    expect(screen.getAllByRole('listitem')).toHaveLength(rowsPerPage)

    await user.click(screen.getByRole('button', { name: 'Show 5 more' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(rowsPerPage + 5)
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull()
  })
})

describe('ItemList search', () => {
  it('marks the searched words in matching titles', async () => {
    await store.createItem({ type: 'note', title: 'Kávé és croissant' })
    await store.createItem({ type: 'note', title: 'Tea' })
    renderPage(<ItemList store={store} spaces={new Map()} query="kave" />)

    const row = await screen.findByRole('link', { name: 'Kávé és croissant' })
    expect(row.querySelector('mark')?.textContent).toBe('Kávé')
    expect(screen.queryByRole('link', { name: 'Tea' })).toBeNull()
  })
})
