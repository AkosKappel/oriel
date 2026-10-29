import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { AccountLink } from '#/components/account-link'
import { CaptureBar } from '#/components/capture-bar'
import { ItemList } from '#/components/item-list'
import { SearchField } from '#/components/search-field'
import { SpaceFilter, TaskFilter, TypeFilter } from '#/components/type-filter'
import { database, store } from '#/data/client'
import { announce, describeMemberChanges } from '#/data/member-changes'
import { dueFilters, itemsInView, trashDays, views } from '#/data/organize'
import { type Item, itemTypes, statusSchema } from '#/data/schema'
import { useAccount } from '#/lib/account'
import { formatDay, greeting } from '#/lib/dates'
import { reportError } from '#/lib/report-error'
import { canEdit, type SpaceView, useSpaces } from '#/lib/spaces'
import { useRows } from '#/lib/use-rows'
import { cn } from '#/lib/utils'

const searchSchema = z.object({
  type: z.enum(itemTypes).optional().catch(undefined),
  status: statusSchema.unwrap().optional().catch(undefined),
  due: z.enum(dueFilters).optional().catch(undefined),
  space: z.uuid().optional().catch(undefined),
  q: z.string().max(200).optional().catch(undefined),
  view: z.enum(views).optional().catch(undefined),
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
  const { type, status, due, space: spaceId, q, view } = Route.useSearch()
  const openItemId = useParams({ strict: false }).itemId
  const itemOpen = openItemId !== undefined
  useEscapeToClose(openItemId)
  useNextAndPreviousKeys()
  usePurgeOldTrash()
  const { spaces, byId } = useSpaces()
  const space = spaceId ? byId.get(spaceId) : undefined
  const now = new Date()
  // One main landmark: the list on its own, the item when one is open. Roles switch instead of
  // tags, so opening an item does not remount the list and drop focus from the clicked row.
  const listRole = itemOpen ? 'region' : 'main'
  const itemRole = itemOpen ? 'main' : undefined

  if (storageFailed) return <StorageProblem />

  return (
    <div className="mx-auto max-w-xl px-4 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,26rem)_minmax(0,36rem)] lg:justify-between lg:gap-16 lg:px-8 print:block">
      <AppBadge />
      <MemberAnnouncer spaces={byId} />
      <CommandPaletteOnShortcut />
      <div
        className={cn(
          'min-h-dvh flex-col pt-[max(1rem,env(safe-area-inset-top))]',
          // A printed item leaves the list off the page.
          itemOpen ? 'hidden lg:flex print:hidden' : 'flex',
        )}
      >
        {/* The left margin holds task checkboxes, so every title starts on the same line. */}
        <header className="flex flex-col gap-1 pt-6 pb-4 pl-10">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{formatDay(now)}</p>
            <div className="flex gap-4">
              <Link
                to="/settings"
                className="rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
              >
                Settings
              </Link>
              <AccountLink />
            </div>
          </div>
          <h1 className="font-serif text-4xl tracking-tight">
            {greeting(now)}
          </h1>
          {spaces.length > 1 && (
            <SpaceFilter spaces={spaces} active={spaceId} />
          )}
          <TypeFilter active={type} />
          {type === 'task' && <TaskFilter status={status} due={due} />}
          <SearchField query={q} />
        </header>
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is always region or main, both take a label */}
        <div
          role={listRole}
          aria-label={itemOpen ? 'Everything' : undefined}
          className="flex flex-1 flex-col pb-6 pl-10"
        >
          <ItemList
            store={store}
            type={type}
            status={status}
            due={due}
            spaceId={spaceId}
            query={q}
            view={view}
            spaces={byId}
          />
          {!view && (
            <nav
              aria-label="Put away"
              className="mt-auto flex gap-x-4 pt-10 text-sm"
            >
              <Link
                to="/"
                search={(previous) => ({ ...previous, view: 'archive' })}
                className="rounded-sm py-2 text-muted-foreground hover:text-foreground focus-visible:outline-2"
              >
                Archive
              </Link>
              <Link
                to="/"
                search={(previous) => ({ ...previous, view: 'trash' })}
                className="rounded-sm py-2 text-muted-foreground hover:text-foreground focus-visible:outline-2"
              >
                Trash
              </Link>
            </nav>
          )}
        </div>
        {view ? null : spaceId && !space ? (
          // A space created or joined a moment ago reaches the device through sync. Capturing
          // before then would file the item in the personal space instead.
          <p
            role="status"
            className="pb-[max(1rem,env(safe-area-inset-bottom))] pl-10 text-sm text-muted-foreground"
          >
            This space is not on this device yet. It appears once it syncs.
          </p>
        ) : space && !canEdit(space.role) ? (
          <p className="pb-[max(1rem,env(safe-area-inset-bottom))] pl-10 text-sm text-muted-foreground">
            You can view {space.name}; only its editors can add to it.
          </p>
        ) : (
          <CaptureBar store={store} preferredType={type} spaceId={space?.id} />
        )}
      </div>
      <div
        role={itemRole}
        className={cn(
          'min-h-dvh flex-col pt-[max(0.5rem,env(safe-area-inset-top))] lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:pt-6 print:static print:h-auto print:overflow-visible',
          itemOpen ? 'flex' : 'hidden lg:flex',
        )}
      >
        <Outlet />
      </div>
    </div>
  )
}

// Loaded on the first Ctrl+K, so home does not carry it (the menu and autocomplete code).
const CommandPalette = lazy(() =>
  import('#/components/command-palette').then((module) => ({
    default: module.CommandPalette,
  })),
)

/** Ctrl+K (⌘K) opens the command palette from anywhere on these pages, also from a text field. */
function CommandPaletteOnShortcut() {
  const [isOpen, setOpen] = useState(false)
  const [wanted, setWanted] = useState(false)
  useEffect(() => {
    function open(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'k') return
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
        return
      event.preventDefault()
      setWanted(true)
      setOpen(true)
    }
    window.addEventListener('keydown', open)
    return () => window.removeEventListener('keydown', open)
  }, [])
  if (!wanted) return null
  return (
    <Suspense fallback={null}>
      <CommandPalette store={store} isOpen={isOpen} onOpenChange={setOpen} />
    </Suspense>
  )
}

/**
 * j and k open the next and previous item in the list, like in mail apps, and move the focus
 * there. Only rows on screen count: not the folded completed tasks, and nothing on a phone
 * while an item covers the list. Text fields and dialogs keep the letters.
 */
function useNextAndPreviousKeys() {
  useEffect(() => {
    function move(event: KeyboardEvent) {
      if (event.key !== 'j' && event.key !== 'k') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      // Dialogs keep them too: the command palette's search re-sends keys to its list.
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"]',
        )
      )
        return
      const links = [
        ...document.querySelectorAll<HTMLAnchorElement>('[data-item-link]'),
      ].filter((link) => link.checkVisibility())
      if (links.length === 0) return
      const focused = links.indexOf(document.activeElement as HTMLAnchorElement)
      const current =
        focused !== -1
          ? focused
          : links.findIndex((link) => link.dataset.status === 'active')
      const step = event.key === 'j' ? 1 : -1
      const next =
        current === -1
          ? 0
          : Math.min(links.length - 1, Math.max(0, current + step))
      event.preventDefault()
      links[next].focus()
      links[next].click()
    }
    document.addEventListener('keydown', move)
    return () => document.removeEventListener('keydown', move)
  }, [])
}

/**
 * Escape closes the open item and puts focus back on its row in the list. Text fields keep Escape
 * for themselves (it reverts an edit), and so do dialogs, which stop the event first.
 */
function useEscapeToClose(itemId: string | undefined) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!itemId) return
    async function close(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable="true"]')) return
      await navigate({ to: '/', search: true })
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`a[href^="/items/${itemId}"]`)
          ?.focus(),
      )
    }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [itemId, navigate])
}

/** Deletes what has been in the trash for longer than it promises to keep it, once per visit. */
/** Open tasks as a number on the installed app's icon (Badging API, where supported). */
/**
 * Tells screen reader users what other members of shared spaces just added or finished, which
 * sighted users notice as the list changes. Nothing is said on load or about the user's own changes.
 */
function MemberAnnouncer({ spaces }: { spaces: Map<string, SpaceView> }) {
  const account = useAccount()
  const { data: items, isLoading } = useRows(store.items)
  const previous = useRef<Map<string, Item> | null>(null)
  const latestSpaces = useRef(spaces)
  latestSpaces.current = spaces
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isLoading) return
    const before = previous.current
    previous.current = new Map(items.map((item) => [item.id, item]))
    if (!before || !account) return
    const messages = describeMemberChanges(
      before,
      items,
      account.userId,
      (item, userId) =>
        latestSpaces.current
          .get(item.space_id ?? '')
          ?.members.find((member) => member.user_id === userId)?.member_name,
    )
    if (messages.length > 0) setMessage(announce(messages))
  }, [items, isLoading, account])

  return (
    <p role="status" className="sr-only">
      {message}
    </p>
  )
}

function AppBadge() {
  const { data: items } = useRows(store.items)
  const open = itemsInView(items).filter(
    (item) => item.type === 'task' && !item.completed_at,
  ).length
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const update =
      open > 0 ? navigator.setAppBadge(open) : navigator.clearAppBadge()
    update.catch(() => {
      // Not an installed app, or the user turned badges off: nothing to show.
    })
  }, [open])
  return null
}

function usePurgeOldTrash() {
  useEffect(() => {
    const cutoff = new Date(Date.now() - trashDays * 86_400_000).toISOString()
    store.deleteTrashedBefore(cutoff).catch((error: unknown) => {
      reportError('Could not empty old trash', error)
    })
  }, [])
}

/** True when the browser refuses the local database, which otherwise shows as an empty page. */
function useStorageFailed() {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    database.init().catch((error: unknown) => {
      reportError('Could not open the local database', error)
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
