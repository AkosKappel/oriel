import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  configure,
  render,
  screen,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { Toaster, toast } from 'sonner'
import { afterEach, expect, vi } from 'vitest'
import { database, store } from './client'

// jsdom lacks the layout APIs the components use; nothing here measures anything.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList

Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.hasPointerCapture ??= () => false

// Writes go through a SQLite worker; with the whole suite running in parallel, the default
// second for `findBy` and `waitFor` is not always enough.
configure({ asyncUtilTimeout: 5000 })
// A test waits for several such writes in a row, so it gets more time than any single wait; on a
// busy CI runner the whole test took over 5 seconds while each step still finished in time.
vi.setConfig({ testTimeout: 30_000 })

afterEach(async () => {
  cleanup()
  // Sonner keeps toasts in module state, beyond the unmounted Toaster.
  toast.dismiss()
  await database.execute('DELETE FROM entries')
  await database.execute('DELETE FROM items')
  // The collections learn about the deletes asynchronously; the next test must start empty.
  await vi.waitFor(() => {
    expect(store.items.size + store.entries.size).toBe(0)
  })
})

/** Renders a component inside a router (for links) with the toaster (for Undo). */
export function renderPage(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <>
          {ui}
          <Toaster />
        </>
      ),
    }),
    history: createMemoryHistory(),
  })
  return render(<RouterProvider router={router} />)
}

/** The Undo button of the toast with this message, so an older toast's Undo is never clicked. */
export async function findUndo(message: string) {
  const toastItem = (await screen.findByText(message)).closest('li')
  if (!toastItem) throw new Error(`No toast says "${message}"`)
  return within(toastItem).getByRole('button', { name: 'Undo' })
}
