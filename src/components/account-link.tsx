import { Link } from '@tanstack/react-router'
import { useAccount } from '#/lib/account'

const linkClass =
  '-mr-2 rounded-sm px-2 py-2 text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2'

/** No account is needed to use Oriel; this is the quiet way in when someone wants one. */
export function AccountLink() {
  const account = useAccount()
  if (!account) {
    return (
      <Link to="/sign-in" className={linkClass}>
        Sign in
      </Link>
    )
  }
  return (
    <Link to="/account" className={linkClass}>
      {account.name.split(' ')[0]}
    </Link>
  )
}
