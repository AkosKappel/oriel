import { createFileRoute } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="py-3">
        <h1 className="text-lg font-semibold tracking-tight">Oriel</h1>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <Inbox aria-hidden className="size-10 text-muted-foreground" />
        <p className="font-medium">Nothing here yet</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Notes, lists and tasks you capture will show up here.
        </p>
      </main>
    </div>
  )
}
