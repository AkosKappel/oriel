import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { SubPage } from '#/components/sub-page'
import { pendingChanges, signOut, useAccount } from '#/lib/account'
import { useOnline } from '#/lib/online'
import { describeSync, useSyncStatus } from '#/lib/sync-status'

export const Route = createFileRoute('/account')({
  ssr: false,
  component: AccountPage,
})

const quietButton =
  'h-11 rounded-sm px-4 text-sm transition-colors data-focus-visible:outline-2 data-focus-visible:outline-offset-2 motion-reduce:transition-none'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

/** Changes not yet on the server, refreshed whenever the sync status changes. */
function usePendingChanges() {
  const status = useSyncStatus()
  const [pending, setPending] = useState<number | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: every status change may change the count
  useEffect(() => {
    let current = true
    pendingChanges().then((count) => {
      if (current) setPending(count)
    })
    return () => {
      current = false
    }
  }, [status])
  return pending
}

function AccountPage() {
  const account = useAccount()
  const status = useSyncStatus()
  const online = useOnline()
  const pending = usePendingChanges()
  if (!account) return <Navigate to="/sign-in" replace />

  const state = account.needsSignIn
    ? 'Signed out on the server'
    : online
      ? (describeSync(status, online) ?? 'Connecting')
      : 'Offline'

  return (
    <SubPage>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{account.email}</p>
        <h1 className="font-serif text-4xl tracking-tight">{account.name}</h1>
      </div>

      <section aria-label="Sync" className="flex flex-col gap-1">
        <p className="font-serif text-lg">{state}</p>
        <p className="text-sm text-muted-foreground">
          {status?.lastSyncedAt
            ? `Last synced ${timeFormat.format(status.lastSyncedAt)}. `
            : ''}
          {pending
            ? `${pending} ${pending === 1 ? 'change' : 'changes'} waiting to upload.`
            : 'Everything on this device is saved to your account.'}
        </p>
        {account.needsSignIn && (
          <Link
            to="/sign-in"
            search={{ mode: 'sign-in' }}
            className="w-fit text-sm underline underline-offset-4"
          >
            Sign in again to keep syncing
          </Link>
        )}
      </section>

      <Link
        to="/spaces"
        className="w-fit font-serif text-lg underline decoration-1 underline-offset-4"
      >
        Spaces and sharing
      </Link>

      <SignOut pending={pending ?? 0} />
    </SubPage>
  )
}

function SignOut({ pending }: { pending: number }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm(close: () => void) {
    setBusy(true)
    try {
      await signOut()
      close()
      // A fresh start, so no screen still shows the removed data.
      window.location.assign('/')
    } catch (caught) {
      console.error('Sign-out failed', caught)
      setError('Could not sign out. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogTrigger>
      <Button
        className={`${quietButton} -ml-4 w-fit text-muted-foreground hover:text-foreground`}
      >
        Sign out
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center"
      >
        <Modal className="w-full max-w-sm rounded-md bg-background p-6 shadow-lg">
          <Dialog
            role="alertdialog"
            className="flex flex-col gap-3 outline-none"
          >
            {({ close }) => (
              <>
                <Heading slot="title" className="font-serif text-2xl">
                  Sign out of Oriel?
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {pending > 0
                    ? `${pending} ${pending === 1 ? 'change has' : 'changes have'} not reached your account yet. Oriel tries to send them first; anything it cannot send is lost.`
                    : 'Your notes are saved to your account. Signing out removes them from this device; sign in again to get them back.'}
                </p>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    autoFocus
                    className={`${quietButton} text-muted-foreground hover:text-foreground`}
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => void confirm(close)}
                    isPending={busy}
                    className={`${quietButton} bg-foreground text-background data-pending:opacity-60`}
                  >
                    Sign out
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
