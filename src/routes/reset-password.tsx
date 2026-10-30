import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import { authClient } from '#/lib/auth-client'
import { text } from '#/lib/search-params'

// The emailed link goes through Better Auth, which comes back here with `token`, or with
// `error=INVALID_TOKEN` when the link is expired or was used already.

export const Route = createFileRoute('/reset-password')({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { token?: string; error?: string } => ({
    token: text(search.token),
    error: text(search.error),
  }),
  component: ResetPassword,
})

const submitClass =
  'h-11 w-fit rounded-sm bg-foreground px-5 text-sm text-background transition-opacity data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-pending:opacity-60 motion-reduce:transition-none'

const failureMessage = () =>
  navigator.onLine
    ? 'Something went wrong. Try again.'
    : 'You are offline. Resetting a password needs a connection.'

function ResetPassword() {
  const { token, error } = Route.useSearch()
  return (
    <SubPage>
      {token ? (
        <ChooseNewPassword token={token} />
      ) : (
        <RequestLink expired={Boolean(error)} />
      )}
    </SubPage>
  )
}

function RequestLink({ expired }: { expired: boolean }) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email'))
    setError(null)
    setBusy(true)
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email,
        redirectTo: '/reset-password',
      })
      if (authError) {
        setError(authError.message ?? failureMessage())
        return
      }
      setSentTo(email)
    } catch (caught) {
      console.error('Password reset request failed', caught)
      setError(failureMessage())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">
          Reset your password
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {expired
            ? 'That link has expired or was used already. Ask for a new one below.'
            : 'Enter the email of your account and we will send you a link to choose a new password.'}
        </p>
      </div>

      {sentTo ? (
        // The same answer whether or not the account exists, so the page does not reveal it.
        <p role="status" className="max-w-sm">
          If {sentTo} has an account, a link is on its way. It works once and
          expires in an hour.
        </p>
      ) : (
        <Form
          onSubmit={submit}
          validationBehavior="native"
          className="flex max-w-sm flex-col gap-5"
        >
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            isRequired
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" isPending={busy} className={submitClass}>
            Send link
          </Button>
        </Form>
      )}

      <p className="text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link
          to="/sign-in"
          search={{ mode: 'sign-in' }}
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </>
  )
}

function ChooseNewPassword({ token }: { token: string }) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const newPassword = String(
      new FormData(event.currentTarget).get('password'),
    )
    setError(null)
    setBusy(true)
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword,
        token,
      })
      if (authError) {
        setError(
          authError.code === 'INVALID_TOKEN'
            ? 'That link has expired or was used already. Ask for a new one.'
            : (authError.message ?? failureMessage()),
        )
        return
      }
      toast('Password changed. Sign in with the new one.')
      await navigate({ to: '/sign-in', search: { mode: 'sign-in' } })
    } catch (caught) {
      console.error('Password reset failed', caught)
      setError(failureMessage())
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">
          Choose a new password
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          At least 10 characters. You will be signed out on your other devices.
        </p>
      </div>
      <Form
        onSubmit={submit}
        validationBehavior="native"
        className="flex max-w-sm flex-col gap-5"
      >
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          isRequired
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" isPending={busy} className={submitClass}>
          Change password
        </Button>
      </Form>
    </>
  )
}
