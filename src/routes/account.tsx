import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { signOut, useAccount } from '#/lib/account'

export const Route = createFileRoute('/account')({
  ssr: false,
  component: AccountPage,
})

const quietButton =
  'h-11 rounded-sm px-4 text-sm transition-colors data-focus-visible:outline-2 data-focus-visible:outline-offset-2 motion-reduce:transition-none'

function AccountPage() {
  const account = useAccount()
  if (!account) return <Navigate to="/sign-in" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link
        to="/"
        className="-ml-3 flex h-11 w-fit items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Everything
      </Link>
      <main className="flex flex-col gap-8 pt-8 pb-12 pl-10">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{account.email}</p>
          <h1 className="font-serif text-4xl tracking-tight">{account.name}</h1>
        </div>
        <p className="max-w-sm font-serif text-lg leading-relaxed">
          Your notes, lists and tasks belong to your personal space. They are
          saved on this device; syncing between your devices is coming next.
        </p>
        <SignOut />
      </main>
    </div>
  )
}

function SignOut() {
  const [error, setError] = useState<string | null>(null)

  async function confirm(close: () => void) {
    try {
      await signOut()
      close()
      // A fresh start, so no screen still shows the removed data.
      window.location.assign('/')
    } catch (caught) {
      console.error('Sign-out failed', caught)
      setError('Could not sign out. Check the connection and try again.')
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
                  Signing out removes your notes from this device. They are not
                  synced anywhere yet, so they would be lost.
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
                    className={`${quietButton} bg-destructive text-background`}
                  >
                    Sign out and remove
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
