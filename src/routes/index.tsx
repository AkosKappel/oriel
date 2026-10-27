import { createFileRoute } from '@tanstack/react-router'
import { CaptureBar } from '#/components/capture-bar'
import { ItemList } from '#/components/item-list'
import { store } from '#/data/client'

export const Route = createFileRoute('/')({
  // Data lives in the browser's SQLite database, so there is nothing to render on the server.
  ssr: false,
  component: Home,
})

function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <header className="py-4">
        <h1 className="text-lg font-semibold tracking-tight">Oriel</h1>
      </header>
      <main className="flex flex-1 flex-col pb-4">
        <ItemList store={store} />
      </main>
      <CaptureBar store={store} />
    </div>
  )
}
