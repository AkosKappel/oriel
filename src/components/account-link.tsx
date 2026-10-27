import { Link } from '@tanstack/react-router'
import { useAccount } from '#/lib/account'
import { useOnline } from '#/lib/online'
import { describeSync, useSyncStatus } from '#/lib/sync-status'

const linkClass =
  '-mr-2 rounded-sm px-2 py-2 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2'

/** No account is needed to use Oriel; this is the quiet way in, and the sync state once in. */
export function AccountLink() {
  const account = useAccount()
  const status = useSyncStatus()
  const online = useOnline()

  if (!account) {
    return (
      <Link to="/sign-in" className={linkClass}>
        Sign in
      </Link>
    )
  }
  if (account.needsSignIn) {
    return (
      <Link to="/sign-in" search={{ mode: 'sign-in' }} className={linkClass}>
        Sign in to sync
      </Link>
    )
  }

  const sync = describeSync(status, online)
  return (
    <Link to="/account" className={linkClass}>
      {sync && <span className="text-muted-foreground">{sync} · </span>}
      {account.name.split(' ')[0]}
    </Link>
  )
}
