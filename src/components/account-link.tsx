import { Link } from '@tanstack/react-router'
import { useAccount } from '#/lib/account'
import { m } from '#/paraglide/messages.js'

const linkClass =
  '-mr-2 rounded-sm px-2 py-2 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2'

/**
 * No account is needed to use Oriel; this is the quiet way in, and the sync state once in. The
 * notebook passes that state (`describeSync`): reading it here would load the local database on
 * every page with a header.
 */
export function AccountLink({ sync }: { sync?: string | null }) {
  const account = useAccount()

  if (!account) {
    return (
      <Link to="/sign-in" className={linkClass}>
        {m.nav_sign_in()}
      </Link>
    )
  }
  if (account.needsSignIn) {
    return (
      <Link to="/sign-in" search={{ mode: 'sign-in' }} className={linkClass}>
        {m.nav_sign_in_to_sync()}
      </Link>
    )
  }

  return (
    <Link to="/account" className={linkClass}>
      {sync && <span className="text-muted-foreground">{sync} · </span>}
      {account.name.split(' ')[0]}
    </Link>
  )
}
