import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { z } from 'zod'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import { completeSignIn, DifferentAccountError } from '#/lib/account'
import { authClient } from '#/lib/auth-client'
import { pageMeta } from '#/lib/seo'

const searchSchema = z.object({
  mode: z.enum(['sign-in', 'create']).optional().catch(undefined),
  // Where to continue after signing in; only paths inside the app.
  redirect: z
    .string()
    .regex(/^\/(?!\/)/)
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  head: () => ({
    meta: pageMeta(
      'Sign in to Oriel',
      'Notes, lists and tasks that work offline and sync between your devices. Create a free account or sign in.',
      { indexed: true },
    ),
  }),
  validateSearch: searchSchema,
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
        setError(authError.message ?? 'That did not work. Try again.')
        return
      }
      const claimed = await completeSignIn()
      toast(
        claimed > 0
          ? `Signed in. ${claimed} ${claimed === 1 ? 'item' : 'items'} from this device now belong to your account.`
          : 'Signed in.',
      )
      await navigate({ to: redirect ?? '/' })
    } catch (caught) {
      console.error('Sign-in failed', caught)
      setError(
        caught instanceof DifferentAccountError
          ? caught.message
          : navigator.onLine
            ? 'Something went wrong. Try again.'
            : 'You are offline. Signing in needs a connection.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubPage>
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">
          {creating ? 'Create an account' : 'Welcome back'}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Oriel works without an account. Create one to keep your notes on all
          your devices and to share lists; everything already on this device
          moves into it.
        </p>
      </div>

      <Form
        onSubmit={submit}
        validationBehavior="native"
        className="flex max-w-sm flex-col gap-5"
      >
        {creating && (
          <TextField label="Name" name="name" autoComplete="name" isRequired />
        )}
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          isRequired
        />
        <TextField
          label="Password"
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
          {creating ? 'Create account' : 'Sign in'}
        </Button>
      </Form>

      {!creating && (
        <Link
          to="/reset-password"
          className="-mt-4 w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Forgot your password?
        </Link>
      )}

      <p className="text-sm text-muted-foreground">
        {creating ? 'Already have an account? ' : 'New to Oriel? '}
        <Link
          to="/sign-in"
          search={{ mode: creating ? 'sign-in' : 'create' }}
          className="text-foreground underline underline-offset-4"
        >
          {creating ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </SubPage>
  )
}
