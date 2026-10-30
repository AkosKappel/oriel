import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import {
  authErrorMessage,
  completeSignIn,
  DifferentAccountError,
} from '#/lib/account'
import { authClient } from '#/lib/auth-client'
import { oneOf, text } from '#/lib/search-params'
import { pageMeta } from '#/lib/seo'
import { m } from '#/paraglide/messages.js'

// Where to continue after signing in; only paths inside the app.
const appPath = (value: unknown) => {
  const path = text(value)
  return path && /^\/(?!\/)/.test(path) ? path : undefined
}

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  head: () => ({
    meta: pageMeta(m.signin_meta_title(), m.signin_meta_description(), {
      indexed: true,
    }),
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { mode?: 'sign-in' | 'create'; redirect?: string } => ({
    mode: oneOf(['sign-in', 'create'] as const, search.mode),
    redirect: appPath(search.redirect),
  }),
  component: SignIn,
})

function SignIn() {
  const { mode = 'create', redirect } = Route.useSearch()
  const creating = mode === 'create'
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setError(null)
    setBusy(true)
    try {
      const { error: authError } = creating
        ? await authClient.signUp.email({
            name: String(form.get('name')),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password })
      if (authError) {
        setError(authErrorMessage(authError, m.error_try_again()))
        return
      }
      const claimed = await completeSignIn()
      toast(
        claimed > 0
          ? m.signin_done_claimed({ count: claimed })
          : m.signin_done(),
      )
      await navigate({ to: redirect ?? '/app' })
    } catch (caught) {
      console.error('Sign-in failed', caught)
      setError(
        caught instanceof DifferentAccountError
          ? caught.message
          : navigator.onLine
            ? m.error_something()
            : m.signin_offline(),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubPage>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">
          {creating ? m.signin_create_title() : m.signin_welcome()}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {m.signin_explain()}
        </p>
      </div>

      <Form
        onSubmit={submit}
        validationBehavior="native"
        className="flex max-w-sm flex-col gap-5"
      >
        {creating && (
          <TextField
            label={m.signin_name()}
            name="name"
            autoComplete="name"
            isRequired
          />
        )}
        <TextField
          label={m.signin_email()}
          name="email"
          type="email"
          autoComplete="email"
          isRequired
        />
        <TextField
          label={m.signin_password()}
          name="password"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          minLength={creating ? 10 : undefined}
          isRequired
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          isPending={busy}
          className="h-11 w-fit rounded-sm bg-foreground px-5 text-sm text-background transition-opacity data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-pending:opacity-60 motion-reduce:transition-none"
        >
          {creating ? m.signin_create_button() : m.signin_button()}
        </Button>
      </Form>

      {!creating && (
        <Link
          to="/reset-password"
          className="-mt-4 w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {m.signin_forgot()}
        </Link>
      )}

      <p className="text-sm text-muted-foreground">
        {creating ? m.signin_have_account() : m.signin_new()}{' '}
        <Link
          to="/sign-in"
          search={{ mode: creating ? 'sign-in' : 'create' }}
          className="text-foreground underline underline-offset-4"
        >
          {creating ? m.signin_button() : m.signin_create_title()}
        </Link>
      </p>
    </SubPage>
  )
}
