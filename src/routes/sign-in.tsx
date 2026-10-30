import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import {
  authErrorMessage,
  completeSignIn,
  DifferentAccountError,
  passkeyCancelled,
  passkeysSupported,
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

// Errors that come after a person picked a passkey, so asking again cannot loop by itself.
const afterPick = new Set([
  'CHALLENGE_NOT_FOUND',
  'PASSKEY_NOT_FOUND',
  'AUTHENTICATION_FAILED',
])

function SignIn() {
  const { mode = 'create', redirect } = Route.useSearch()
  const creating = mode === 'create'
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )

  /**
   * Runs one way of signing in, then finishes it. Returns true once signed in, otherwise the
   * error's code. A quiet attempt (passkey autofill, which waits for the person to pick one) keeps
   * the buttons usable until a passkey is picked.
   */
  async function signIn(
    attempt: () => Promise<{
      error: { code?: string; message?: string; status?: number } | null
    }>,
    quiet = false,
  ): Promise<true | string | undefined> {
    let holding = !quiet
    if (holding) {
      setError(null)
      setBusy(true)
    }
    try {
      const { error: authError } = await attempt()
      if (authError) {
        // An expired challenge only means the page sat open a while; autofill asks again.
        const expired = quiet && authError.code === 'CHALLENGE_NOT_FOUND'
        if (!passkeyCancelled(authError) && !expired) {
          setError(authErrorMessage(authError, m.error_try_again()))
        }
        return authError.code
      }
      holding = true
      setBusy(true)
      const claimed = await completeSignIn()
      toast(
        claimed > 0
          ? m.signin_done_claimed({ count: claimed })
          : m.signin_done(),
      )
      await navigate({ to: redirect ?? '/app' })
      return true
    } catch (caught) {
      console.error('Sign-in failed', caught)
      setError(
        caught instanceof DifferentAccountError
          ? caught.message
          : navigator.onLine
            ? m.error_something()
            : m.signin_offline(),
      )
      return undefined
    } finally {
      if (holding) setBusy(false)
    }
  }

  /**
   * Offers saved passkeys in the email field's suggestions (conditional mediation). The request
   * waits until one is picked and is replaced by the passkey button's own request. After leaving
   * the page it stays pending, harmlessly, until another passkey request replaces it.
   */
  async function offerPasskeys() {
    if (
      !(await window.PublicKeyCredential?.isConditionalMediationAvailable?.())
    )
      return
    for (;;) {
      const result = await signIn(
        () => authClient.signIn.passkey({ autoFill: true }),
        true,
      )
      // Ask again only after a picked passkey failed; anything else would repeat at once.
      if (!mounted.current || !afterPick.has(result as string)) return
    }
  }

  async function signInWithPasskey() {
    const result = await signIn(() => authClient.signIn.passkey())
    if (result !== true && mounted.current) void offerPasskeys()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    void signIn(() =>
      creating
        ? authClient.signUp.email({
            name: String(form.get('name')),
            email,
            password,
          })
        : authClient.signIn.email({ email, password }),
    )
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: start once per mode
  useEffect(() => {
    if (!creating) void offerPasskeys()
  }, [creating])

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
          autoComplete={creating ? 'email' : 'email webauthn'}
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

      {!creating && passkeysSupported() && (
        <Button
          onPress={() => void signInWithPasskey()}
          isDisabled={busy}
          className="-mt-4 h-11 w-fit text-sm underline underline-offset-4 data-disabled:opacity-60 data-focus-visible:outline-2"
        >
          {m.signin_passkey()}
        </Button>
      )}

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
