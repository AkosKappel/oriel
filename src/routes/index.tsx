import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AccountLink } from '#/components/account-link'
import { CaptureBar } from '#/components/capture-bar'
import { ItemList } from '#/components/item-list'
import { SpaceFilter, TypeFilter } from '#/components/type-filter'
import { store } from '#/data/client'
import { itemTypes } from '#/data/schema'
import { formatDay, greeting } from '#/lib/dates'
import { canEdit, useSpaces } from '#/lib/spaces'

const searchSchema = z.object({
  type: z.enum(itemTypes).optional().catch(undefined),
  space: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/')({
  // Data lives in the browser's SQLite database, so there is nothing to render on the server.
  ssr: false,
  validateSearch: searchSchema,
  component: Home,
})

function Home() {
  const { type, space: spaceId } = Route.useSearch()
  const { spaces, byId } = useSpaces()
  const space = spaceId ? byId.get(spaceId) : undefined
  const now = new Date()

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* The left margin holds task checkboxes, so every title starts on the same line. */}
      <header className="flex flex-col gap-1 pt-6 pb-4 pl-10">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{formatDay(now)}</p>
          <AccountLink />
        </div>
        <h1 className="font-serif text-4xl tracking-tight">{greeting(now)}</h1>
        {spaces.length > 1 && <SpaceFilter spaces={spaces} active={spaceId} />}
        <TypeFilter active={type} />
      </header>
      <main className="flex flex-1 flex-col pb-6 pl-10">
        <ItemList store={store} type={type} spaceId={spaceId} spaces={byId} />
      </main>
      {space && !canEdit(space.role) ? (
        <p className="pb-[max(1rem,env(safe-area-inset-bottom))] pl-10 text-sm text-muted-foreground">
          You can view {space.name}; only its editors can add to it.
        </p>
      ) : (
        <CaptureBar store={store} preferredType={type} spaceId={space?.id} />
      )}
    </div>
  )
}
