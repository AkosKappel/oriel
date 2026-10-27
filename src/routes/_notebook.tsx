import { createFileRoute, Outlet, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { AccountLink } from '#/components/account-link'
import { CaptureBar } from '#/components/capture-bar'
import { ItemList } from '#/components/item-list'
import { SpaceFilter, TypeFilter } from '#/components/type-filter'
import { database, store } from '#/data/client'
import { itemTypes } from '#/data/schema'
import { formatDay, greeting } from '#/lib/dates'
import { canEdit, useSpaces } from '#/lib/spaces'
import { cn } from '#/lib/utils'

const searchSchema = z.object({
  type: z.enum(itemTypes).optional().catch(undefined),
  space: z.uuid().optional().catch(undefined),
})

export const Route = createFileRoute('/_notebook')({
  // Data lives in the browser's SQLite database, so there is nothing to render on the server.
  ssr: false,
  validateSearch: searchSchema,
  component: Notebook,
})

/**
 * Home and the item page share one frame. On a phone they are separate screens; on a wide screen
 * the list stays on the left and the open item reads beside it.
 */
function Notebook() {
  const storageFailed = useStorageFailed()
  const { type, space: spaceId } = Route.useSearch()
  const itemOpen = useParams({ strict: false }).itemId !== undefined
  const { spaces, byId } = useSpaces()
  const space = spaceId ? byId.get(spaceId) : undefined
  const now = new Date()
  // One main landmark: the list on its own, the item when one is open.
  const ListArea = itemOpen ? 'section' : 'main'
  const ItemArea = itemOpen ? 'main' : 'div'

  if (storageFailed) return <StorageProblem />

  return (
    <div className="mx-auto max-w-xl px-4 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,26rem)_minmax(0,36rem)] lg:justify-between lg:gap-16 lg:px-8">
      <div
        className={cn(
          'flex min-h-dvh flex-col pt-[max(1rem,env(safe-area-inset-top))]',
          itemOpen && 'hidden lg:flex',
        )}
      >
        {/* The left margin holds task checkboxes, so every title starts on the same line. */}
        <header className="flex flex-col gap-1 pt-6 pb-4 pl-10">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{formatDay(now)}</p>
            <AccountLink />
          </div>
          <h1 className="font-serif text-4xl tracking-tight">
            {greeting(now)}
          </h1>
          {spaces.length > 1 && (
            <SpaceFilter spaces={spaces} active={spaceId} />
          )}
          <TypeFilter active={type} />
        </header>
        <ListArea
          aria-label={itemOpen ? 'Everything' : undefined}
          className="flex flex-1 flex-col pb-6 pl-10"
        >
          <ItemList store={store} type={type} spaceId={spaceId} spaces={byId} />
        </ListArea>
        {space && !canEdit(space.role) ? (
          <p className="pb-[max(1rem,env(safe-area-inset-bottom))] pl-10 text-sm text-muted-foreground">
            You can view {space.name}; only its editors can add to it.
          </p>
        ) : (
          <CaptureBar store={store} preferredType={type} spaceId={space?.id} />
        )}
      </div>
      <ItemArea
        className={cn(
          'flex min-h-dvh flex-col pt-[max(0.5rem,env(safe-area-inset-top))] lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:pt-6',
          !itemOpen && 'hidden lg:flex',
        )}
      >
        <Outlet />
      </ItemArea>
    </div>
  )
}

/** True when the browser refuses the local database, which otherwise shows as an empty page. */
function useStorageFailed() {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    database.init().catch((error: unknown) => {
      console.error('Could not open the local database', error)
      setFailed(true)
    })
  }, [])
  return failed
}

function StorageProblem() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-4 pb-24 pl-14">
      <h1 className="font-serif text-3xl italic">
        Oriel cannot open its notebook.
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Oriel keeps everything in this browser's storage, and the browser said
        no. Private or incognito windows, a full disk, or blocked site data are
        the usual causes. Try a normal window, free some space, or allow storage
        for this site, then{' '}
        <a href="/" className="text-foreground underline underline-offset-4">
          reload
        </a>
        .
      </p>
    </main>
  )
}
