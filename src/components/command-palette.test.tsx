// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { store } from '#/test/client'
import { renderPage } from '#/test/dom'
import { CommandPalette } from './command-palette'

vi.mock('#/data/client', () => import('#/test/client'))

describe('CommandPalette', () => {
  it('opens with Ctrl+K and goes to the item typed, ignoring accents', async () => {
    const user = userEvent.setup()
    const id = await store.createItem({
      type: 'note',
      title: 'Kávé és croissant',
    })
    await store.createItem({ type: 'list', title: 'Groceries' })
    const { router } = renderPage(<CommandPalette store={store} />)
    await waitFor(() => expect(store.items.size).toBe(2))

    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('kave')
    expect(
      await screen.findByRole('menuitem', { name: /Kávé és croissant/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Groceries/ })).toBeNull()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/items/${id}`),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('runs a command', async () => {
    const user = userEvent.setup()
    const { router } = renderPage(<CommandPalette store={store} />)

    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('due today')
    await user.click(
      await screen.findByRole('menuitem', { name: 'Tasks due today' }),
    )

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        type: 'task',
        due: 'today',
      }),
    )
  })
})
