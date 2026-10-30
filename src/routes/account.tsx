import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Form,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import {
  changeName,
  changePassword,
  deleteAccount,
  pendingChanges,
  signOut,
  useAccount,
} from '#/lib/account'
import { useOnline } from '#/lib/online'
import { describeSync, useSyncStatus } from '#/lib/sync-status'
import { getDevices, signOutOtherDevice } from '#/server/account'

export const Route = createFileRoute('/account')({
  ssr: false,
  component: AccountPage,
})

const quietButton =
  'h-11 rounded-sm px-4 text-sm transition-colors data-focus-visible:outline-2 data-focus-visible:outline-offset-2 motion-reduce:transition-none'

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

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

      {!account.needsSignIn && <Devices />}

      <div className="flex flex-col">
        <ChangeName name={account.name} />
        <ChangePassword />
        <SignOut pending={pending ?? 0} />
        <DeleteAccount />
      </div>
    </SubPage>
  )
}

type Device = Awaited<ReturnType<typeof getDevices>>[number]

function Devices() {
  const online = useOnline()
  const [devices, setDevices] = useState<Device[] | null>(null)

  const refresh = useCallback(() => {
    getDevices().then(setDevices, (error) => {
      console.error('Could not load devices', error)
      setDevices(null)
    })
  }, [])
  useEffect(() => {
    if (online) refresh()
  }, [online, refresh])

  async function signOutDevice(device: Device) {
    try {
      await signOutOtherDevice({ data: { sessionId: device.id } })
      toast(`${device.device} is signed out. It stops syncing within minutes.`)
    } catch (error) {
      console.error('Could not sign out the device', error)
      toast('Could not sign out that device. Try again.')
    }
    refresh()
  }

  return (
    <section aria-labelledby="devices" className="flex flex-col gap-1">
      <h2 id="devices" className="text-xs text-muted-foreground">
        Signed-in devices
      </h2>
      {!online ? (
        <p className="text-sm text-muted-foreground">
          Connect to see your devices.
        </p>
      ) : devices === null ? (
        <p className="text-sm text-muted-foreground">Loading</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {devices.map((device) => (
            <li
              key={device.id}
              className="flex min-h-11 items-center justify-between gap-3"
            >
              <span className="flex flex-col">
                <span className="font-serif text-lg">{device.device}</span>
                <span className="text-sm text-muted-foreground">
                  {device.current
                    ? 'This device'
                    : `Signed in ${dayFormat.format(new Date(device.signedInAt))}`}
                </span>
              </span>
              {!device.current && (
                <Button
                  onPress={() => void signOutDevice(device)}
                  aria-label={`Sign out ${device.device}, signed in ${dayFormat.format(new Date(device.signedInAt))}`}
                  className={`${quietButton} -mr-4 text-muted-foreground hover:text-foreground`}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * A quiet button that opens a small form in a dialog. `submit` returns a message to show, or null
 * when done; the dialog then closes.
 */
function FormDialog({
  label,
  title,
  submitLabel,
  submit,
  children,
}: {
  label: string
  title: string
  submitLabel: string
  submit: (form: FormData) => Promise<string | null>
  children: ReactNode
}) {
  const online = useOnline()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(
    event: FormEvent<HTMLFormElement>,
    close: () => void,
  ) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    setBusy(true)
    try {
      const message = await submit(form)
      if (message) setError(message)
      else close()
    } catch (caught) {
      console.error(`${title} failed`, caught)
      setError('That did not work. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogTrigger onOpenChange={() => setError(null)}>
      <Button
        className={`${quietButton} -ml-4 w-fit text-muted-foreground hover:text-foreground`}
      >
        {label}
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center"
      >
        <Modal className="w-full max-w-sm rounded-md bg-background p-6 shadow-lg">
          <Dialog className="flex flex-col gap-3 outline-none">
            {({ close }) => (
              <Form
                onSubmit={(event) => void onSubmit(event, close)}
                validationBehavior="native"
                className="flex flex-col gap-4"
              >
                <Heading slot="title" className="font-serif text-2xl">
                  {title}
                </Heading>
                {children}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {!online && (
                  <p className="text-sm text-muted-foreground">
                    This needs a connection.
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    className={`${quietButton} text-muted-foreground hover:text-foreground`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isPending={busy}
                    isDisabled={!online}
                    className={`${quietButton} bg-foreground text-background data-disabled:opacity-60 data-pending:opacity-60`}
                  >
                    {submitLabel}
                  </Button>
                </div>
              </Form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}

function ChangeName({ name }: { name: string }) {
  return (
    <FormDialog
      label="Change name"
      title="Change your name"
      submitLabel="Save"
      submit={async (form) => {
        const message = await changeName(String(form.get('name')).trim())
        if (!message) toast('Name changed. Shared spaces show it once synced.')
        return message
      }}
    >
      <p className="text-sm text-muted-foreground">
        Members of your shared spaces see this name.
      </p>
      <TextField
        label="Name"
        name="name"
        defaultValue={name}
        autoComplete="name"
        maxLength={100}
        isRequired
        autoFocus
      />
    </FormDialog>
  )
}

function ChangePassword() {
  return (
    <FormDialog
      label="Change password"
      title="Change your password"
      submitLabel="Change password"
      submit={async (form) => {
        const message = await changePassword(
          String(form.get('current')),
          String(form.get('new')),
        )
        if (!message) toast('Password changed. Other devices are signed out.')
        return message
      }}
    >
      <p className="text-sm text-muted-foreground">
        Your other devices are signed out; this one stays signed in.
      </p>
      <TextField
        label="Current password"
        name="current"
        type="password"
        autoComplete="current-password"
        isRequired
        autoFocus
      />
      <TextField
        label="New password"
        name="new"
        type="password"
        autoComplete="new-password"
        minLength={10}
        isRequired
      />
    </FormDialog>
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
      window.location.assign('/app')
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

function DeleteAccount() {
  const online = useOnline()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password'))
    setError(null)
    setBusy(true)
    try {
      const refusal = await deleteAccount(password)
      if (refusal) {
        setError(refusal)
        return
      }
      window.location.assign('/app')
    } catch (caught) {
      console.error('Account deletion failed', caught)
      setError(
        'Could not delete the account. Check the connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogTrigger onOpenChange={() => setError(null)}>
      <Button
        className={`${quietButton} -ml-4 w-fit text-muted-foreground hover:text-destructive`}
      >
        Delete account
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
              <Form
                onSubmit={(event) => void confirm(event)}
                className="flex flex-col gap-3"
              >
                <Heading slot="title" className="font-serif text-2xl">
                  Delete your account?
                </Heading>
                <p className="text-sm text-muted-foreground">
                  Your account, your personal space and every shared space only
                  you use are deleted for good, on the server and on this
                  device. Shared spaces others use stay with them. To keep a
                  copy, export it in{' '}
                  <Link
                    to="/settings"
                    className="text-foreground underline underline-offset-4"
                  >
                    Settings
                  </Link>{' '}
                  first.
                </p>
                <TextField
                  label="Password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  isRequired
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                {!online && (
                  <p className="text-sm text-muted-foreground">
                    Deleting an account needs a connection.
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
                    type="submit"
                    isPending={busy}
                    isDisabled={!online}
                    className={`${quietButton} bg-destructive text-background data-disabled:opacity-60 data-pending:opacity-60`}
                  >
                    Delete for good
                  </Button>
                </div>
              </Form>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}
