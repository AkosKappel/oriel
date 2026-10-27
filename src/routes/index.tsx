import { createFileRoute } from '@tanstack/react-router'
import { CaptureForm } from '#/components/capture-form'
import { ItemList } from '#/components/item-list'
import { store } from '#/data/client'

export const Route = createFileRoute('/')({
  // Data lives in the browser's SQLite database, so there is nothing to render on the server.
  ssr: false,
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="py-3">
        <h1 className="text-lg font-semibold tracking-tight">Oriel</h1>
      </header>
      <CaptureForm store={store} />
      <main className="flex flex-1 flex-col">
        <ItemList store={store} />
      </main>
    </div>
  )
}
