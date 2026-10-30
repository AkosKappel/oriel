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
  authErrorMessage,
  changeName,
  changePassword,
  deleteAccount,
  passkeyCancelled,
  pendingChanges,
  signOut,
  useAccount,
} from '#/lib/account'
import { authClient } from '#/lib/auth-client'
import { describeDevice } from '#/lib/devices'
import { formatLocale } from '#/lib/locale'
import { useOnline } from '#/lib/online'
import { describeSync, useSyncStatus } from '#/lib/sync-status'
import { m } from '#/paraglide/messages.js'
import { getDevices, signOutOtherDevice } from '#/server/account'

export const Route = createFileRoute('/account')({
  ssr: false,
  component: AccountPage,
})

const quietButton =
  'h-11 rounded-sm px-4 text-sm transition-colors data-focus-visible:outline-2 data-focus-visible:outline-offset-2 motion-reduce:transition-none'

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(formatLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat(formatLocale(), {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

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
    ? m.acct_signed_out_server()
    : online
      ? (describeSync(status, online) ?? m.acct_connecting())
      : m.acct_offline()

  return (
    <SubPage>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{account.email}</p>
        <h1 className="font-serif text-4xl tracking-tight">{account.name}</h1>
      </div>

      <section aria-label={m.acct_sync()} className="flex flex-col gap-1">
        <p className="font-serif text-lg">{state}</p>
        <p className="text-sm text-muted-foreground">
          {status?.lastSyncedAt
            ? `${m.acct_last_synced({ time: formatTime(status.lastSyncedAt) })} `
            : ''}
          {pending ? m.acct_pending({ count: pending }) : m.acct_all_saved()}
        </p>
        {account.needsSignIn && (
          <Link
            to="/sign-in"
            search={{ mode: 'sign-in' }}
            className="w-fit text-sm underline underline-offset-4"
          >
            {m.acct_sign_in_again()}
          </Link>
        )}
      </section>

      <Link
        to="/spaces"
        className="w-fit font-serif text-lg underline decoration-1 underline-offset-4"
      >
        {m.acct_spaces_link()}
      </Link>

      {!account.needsSignIn && <Devices />}
      {!account.needsSignIn && <Passkeys />}

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
      toast(m.acct_device_signed_out({ device: device.device }))
    } catch (error) {
      console.error('Could not sign out the device', error)
      toast(m.acct_device_failed())
    }
    refresh()
  }

  return (
    <section aria-labelledby="devices" className="flex flex-col gap-1">
      <h2 id="devices" className="text-xs text-muted-foreground">
        {m.acct_devices()}
      </h2>
      {!online ? (
        <p className="text-sm text-muted-foreground">
          {m.acct_devices_offline()}
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
                    ? m.acct_this_device()
                    : m.acct_signed_in_on({
                        date: formatDate(new Date(device.signedInAt)),
                      })}
                </span>
              </span>
              {!device.current && (
                <Button
                  onPress={() => void signOutDevice(device)}
                  aria-label={m.acct_sign_out_device({
                    device: device.device,
                    date: formatDate(new Date(device.signedInAt)),
                  })}
                  className={`${quietButton} -mr-4 text-muted-foreground hover:text-foreground`}
                >
                  {m.acct_sign_out()}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

type Passkey = { id: string; name?: string | null; createdAt: Date }

function Passkeys() {
  const online = useOnline()
  const { data: passkeys, isPending } = authClient.useListPasskeys()
  const [adding, setAdding] = useState(false)

  async function add() {
    setAdding(true)
    // Named after this browser, so the list tells a phone's passkey from a laptop's.
    const { error } = await authClient.passkey.addPasskey({
      name: describeDevice(navigator.userAgent),
    })
    setAdding(false)
    if (!error) toast(m.acct_passkey_added())
    else if (!passkeyCancelled(error)) {
      toast(authErrorMessage(error, m.acct_passkey_failed()))
    }
  }

  async function remove(passkey: Passkey) {
    const name = passkey.name ?? m.device_unknown()
    const { error } = await authClient.passkey.deletePasskey({ id: passkey.id })
    toast(
      error ? m.acct_passkey_remove_failed() : m.acct_passkey_removed({ name }),
    )
  }

  return (
    <section aria-labelledby="passkeys" className="flex flex-col gap-1">
      <h2 id="passkeys" className="text-xs text-muted-foreground">
        {m.acct_passkeys()}
      </h2>
      <p className="text-sm text-muted-foreground">
        {m.acct_passkeys_explain()}
      </p>
      {!online ? (
        <p className="text-sm text-muted-foreground">
          {m.acct_passkeys_offline()}
        </p>
      ) : isPending ? null : (
        <>
          <ul className="flex flex-col gap-3">
            {(passkeys ?? []).map((passkey) => {
              const name = passkey.name ?? m.device_unknown()
              const date = formatDate(new Date(passkey.createdAt))
              return (
                <li
                  key={passkey.id}
                  className="flex min-h-11 items-center justify-between gap-3"
                >
                  <span className="flex flex-col">
                    <span className="font-serif text-lg">{name}</span>
                    <span className="text-sm text-muted-foreground">
                      {m.acct_passkey_added_on({ date })}
                    </span>
                  </span>
                  <Button
                    onPress={() => void remove(passkey)}
                    aria-label={m.acct_passkey_remove_label({ name, date })}
                    className={`${quietButton} -mr-4 text-muted-foreground hover:text-foreground`}
                  >
                    {m.acct_passkey_remove()}
                  </Button>
                </li>
              )
            })}
          </ul>
          <Button
            onPress={() => void add()}
            isPending={adding}
            className={`${quietButton} -ml-4 w-fit underline underline-offset-4 data-pending:opacity-60`}
          >
            {m.acct_passkey_add()}
          </Button>
        </>
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
      setError(m.acct_check_connection())
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
                    {m.acct_needs_connection()}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    className={`${quietButton} text-muted-foreground hover:text-foreground`}
                  >
                    {m.cancel()}
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
      label={m.acct_change_name()}
      title={m.acct_change_name_title()}
      submitLabel="Save"
      submit={async (form) => {
        const message = await changeName(String(form.get('name')).trim())
        if (!message) toast(m.acct_name_changed())
        return message
      }}
    >
      <p className="text-sm text-muted-foreground">{m.acct_name_explain()}</p>
      <TextField
        label={m.signin_name()}
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
      label={m.acct_change_password()}
      title={m.acct_change_password_title()}
      submitLabel="Change password"
      submit={async (form) => {
        const message = await changePassword(
          String(form.get('current')),
          String(form.get('new')),
        )
        if (!message) toast(m.acct_password_changed())
        return message
      }}
    >
      <p className="text-sm text-muted-foreground">
        {m.acct_password_explain()}
      </p>
      <TextField
        label={m.acct_current_password()}
        name="current"
        type="password"
        autoComplete="current-password"
        isRequired
        autoFocus
      />
      <TextField
        label={m.reset_new_password()}
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
      setError(m.acct_sign_out_failed())
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogTrigger>
      <Button
        className={`${quietButton} -ml-4 w-fit text-muted-foreground hover:text-foreground`}
      >
        {m.acct_sign_out()}
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
                  {m.acct_sign_out_title()}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {pending > 0
                    ? m.acct_sign_out_pending({ count: pending })
                    : m.acct_sign_out_saved()}
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
                    {m.cancel()}
                  </Button>
                  <Button
                    onPress={() => void confirm(close)}
                    isPending={busy}
                    className={`${quietButton} bg-foreground text-background data-pending:opacity-60`}
                  >
                    {m.acct_sign_out()}
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
      setError(m.acct_delete_failed_connection())
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogTrigger onOpenChange={() => setError(null)}>
      <Button
        className={`${quietButton} -ml-4 w-fit text-muted-foreground hover:text-destructive`}
      >
        {m.acct_delete()}
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
                  {m.acct_delete_title()}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {m.acct_delete_explain()}{' '}
                  <Link
                    to="/settings"
                    className="text-foreground underline underline-offset-4"
                  >
                    {m.acct_delete_settings_link()}
                  </Link>
                  {m.acct_delete_explain_end()}
                </p>
                <TextField
                  label={m.signin_password()}
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
                    {m.acct_delete_needs_connection()}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    autoFocus
                    className={`${quietButton} text-muted-foreground hover:text-foreground`}
                  >
                    {m.cancel()}
                  </Button>
                  <Button
                    type="submit"
                    isPending={busy}
                    isDisabled={!online}
                    className={`${quietButton} bg-destructive text-background data-disabled:opacity-60 data-pending:opacity-60`}
                  >
                    {m.acct_delete_for_good()}
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
