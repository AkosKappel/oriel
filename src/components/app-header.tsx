import { Link, useLocation } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Button } from 'react-aria-components'
import { AccountLink } from '#/components/account-link'
import { Logo } from '#/components/logo'
import { useAccount } from '#/lib/account'

/** Asks the notebook's command palette to open, as Ctrl+K does. */
export const openCommandPalette = () =>
  window.dispatchEvent(new Event('oriel:command-palette'))

const navLink =
  'rounded-sm px-2 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 data-[status=active]:text-foreground data-[status=active]:underline data-[status=active]:decoration-[1.5px] data-[status=active]:underline-offset-[6px]'

const activeLink =
  'text-foreground underline decoration-[1.5px] underline-offset-[6px]'

/**
 * The app's bar on wide screens: the name, the main places and the account. Phones keep their own
 * compact header in each page, where vertical space matters more.
 */
export function AppHeader({
  search = false,
  sync,
}: {
  /** The notebook's: a button that opens the command palette. */
  search?: boolean
  /** The sync state beside the account name, from the notebook. */
  sync?: string | null
}) {
  const account = useAccount()
  // An open item belongs to the notebook too.
  const itemOpen = useLocation({
    select: (location) => location.pathname.startsWith('/items/'),
  })
  return (
    <header className="sticky top-0 z-20 hidden h-14 border-b border-rule bg-background lg:block print:hidden">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-6 px-8">
        <Link
          to="/app"
          className="-ml-1 flex items-center gap-2 rounded-sm px-1 py-1 focus-visible:outline-2"
        >
          <Logo className="size-6 text-primary" />
          <span className="font-serif text-xl tracking-tight">Oriel</span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2">
          <Link
            to="/app"
            activeOptions={{ includeSearch: false }}
            className={itemOpen ? `${navLink} ${activeLink}` : navLink}
            aria-current={itemOpen ? 'page' : undefined}
          >
            Notebook
          </Link>
          {account && (
            <Link to="/spaces" className={navLink}>
              Spaces
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {search && (
            <Button
              onPress={openCommandPalette}
              className="flex h-9 w-64 items-center gap-2 rounded-sm bg-wash px-3 text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
            >
              <Search aria-hidden className="size-4" />
              Find or run anything
              <kbd className="ml-auto font-sans text-xs">Ctrl K</kbd>
            </Button>
          )}
          <Link to="/settings" className={navLink}>
            Settings
          </Link>
          <AccountLink sync={sync} />
        </div>
      </div>
    </header>
  )
}
