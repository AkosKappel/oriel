import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { z } from 'zod'
import { TextField } from '#/components/ui/text-field'
import { completeSignIn } from '#/lib/account'
import { authClient } from '#/lib/auth-client'

const searchSchema = z.object({
  mode: z.enum(['sign-in', 'create']).optional().catch(undefined),
})

export const Route = createFileRoute('/sign-in')({
  ssr: false,
  validateSearch: searchSchema,
  component: SignIn,
})

function SignIn() {
  const { mode = 'create' } = Route.useSearch()
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
      await navigate({ to: '/' })
    } catch (caught) {
      console.error('Sign-in failed', caught)
      setError(
        navigator.onLine
          ? 'Something went wrong. Try again.'
          : 'You are offline. Signing in needs a connection.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link
        to="/"
        className="-ml-3 flex h-11 w-fit items-center gap-2 rounded-sm px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Everything
      </Link>
      <main className="flex flex-col gap-6 pt-8 pb-12 pl-10">
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
            <TextField
              label="Name"
              name="name"
              autoComplete="name"
              isRequired
            />
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
      </main>
    </div>
  )
}
