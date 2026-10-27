import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { CaptureBar } from '#/components/capture-bar'
import { ItemList } from '#/components/item-list'
import { TypeFilter } from '#/components/type-filter'
import { store } from '#/data/client'
import { itemTypes } from '#/data/schema'

const searchSchema = z.object({
  type: z.enum(itemTypes).optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  // Data lives in the browser's SQLite database, so there is nothing to render on the server.
  ssr: false,
  validateSearch: searchSchema,
  component: Home,
})

function Home() {
  const { type } = Route.useSearch()

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="flex flex-col gap-2 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Oriel</h1>
        <TypeFilter active={type} />
      </header>
      <main className="flex flex-1 flex-col pb-4">
        <ItemList store={store} type={type} />
      </main>
      <CaptureBar store={store} preferredType={type} />
    </div>
  )
}
