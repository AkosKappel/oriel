// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { store } from '#/test/client'
import { findUndo, renderPage } from '#/test/dom'
import { CaptureBar } from './capture-bar'

vi.mock('#/data/client', () => import('#/test/client'))

const titles = () => store.items.toArray.map((item) => item.title)

describe('CaptureBar', () => {
  it('saves on Enter, clears the field and keeps the focus for the next item', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="note" />)
    const field = await screen.findByRole('textbox', { name: 'New note' })

    await user.type(field, 'Call the vet{Enter}')

    await waitFor(() => expect(titles()).toEqual(['Call the vet']))
    expect(field).toHaveProperty('value', '')
    expect(document.activeElement).toBe(field)
  })

  it('starts a new line on Shift+Enter instead of saving', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="note" />)
    const field = await screen.findByRole('textbox', { name: 'New note' })

    await user.type(field, 'Idea{Shift>}{Enter}{/Shift}Paint the door')

    expect(field).toHaveProperty('value', 'Idea\nPaint the door')
    expect(titles()).toEqual([])
  })

  it('previews and saves a list written on one line', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="list" />)
    const field = await screen.findByRole('textbox', { name: 'New list' })

    await user.type(field, 'Groceries: milk, eggs')
    expect(screen.getByText('Groceries · 2 items')).toBeTruthy()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(store.entries.toArray).toHaveLength(2))
    expect(store.items.toArray[0]).toMatchObject({
      type: 'list',
      title: 'Groceries',
    })
  })

  it('ignores Enter on an empty field', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="task" />)
    const field = await screen.findByRole('textbox', { name: 'New task' })

    await user.type(field, '   {Enter}')

    expect(titles()).toEqual([])
  })

  it('takes a saved item back with Undo', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="task" />)
    const field = await screen.findByRole('textbox', { name: 'New task' })

    await user.type(field, 'Water the plants{Enter}')
    await user.click(await findUndo('Task saved'))

    await waitFor(() => expect(titles()).toEqual([]))
  })

  it('focuses the field when / is pressed anywhere else', async () => {
    const user = userEvent.setup()
    renderPage(<CaptureBar store={store} preferredType="note" />)
    const field = await screen.findByRole('textbox', { name: 'New note' })
    field.blur()

    await user.keyboard('/')

    expect(document.activeElement).toBe(field)
    expect(field).toHaveProperty('value', '')
  })
})
