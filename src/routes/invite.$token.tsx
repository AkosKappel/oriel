import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { useAccount } from '#/lib/account'
import { acceptInvite, describeInvite } from '#/server/sharing-functions'

export const Route = createFileRoute('/invite/$token')({
  ssr: false,
  component: InvitePage,
})

type Invite = Awaited<ReturnType<typeof describeInvite>>

function InvitePage() {
  const { token } = Route.useParams()
  const account = useAccount()
  const navigate = useNavigate()
  const [invite, setInvite] = useState<Invite | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    describeInvite({ data: { token } }).then(setInvite, () => setInvite(null))
  }, [token])

  if (invite === undefined) return null

  if (invite?.state !== 'open') {
    return (
      <SubPage>
        <h1 className="font-serif text-3xl italic">
          {!invite
            ? 'This invite link does not work.'
            : invite.state === 'used'
              ? 'This invite link was already used.'
              : 'This invite link has expired.'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask for a new link. Each one works once, for 7 days.
        </p>
      </SubPage>
    )
  }

  async function join() {
    setBusy(true)
    try {
      await acceptInvite({ data: { token } })
      toast(
        `You joined ${invite?.spaceName}. Its notes and lists arrive in a moment.`,
      )
      await navigate({ to: '/' })
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not join.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubPage>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {invite.inviterName} invites you to
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          {invite.spaceName}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {invite.role === 'viewer'
            ? 'You will be able to see its notes, lists and tasks.'
            : 'You will be able to see and change its notes, lists and tasks.'}
        </p>
      </div>
      {account ? (
        <Button
          onPress={() => void join()}
          isPending={busy}
          className="h-11 w-fit rounded-sm bg-foreground px-5 text-sm text-background data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-pending:opacity-60"
        >
          Join {invite.spaceName}
        </Button>
      ) : (
        <p className="max-w-sm text-sm">
          Joining a shared space needs an account.{' '}
          <Link
            to="/sign-in"
            search={{ redirect: `/invite/${token}` }}
            className="underline underline-offset-4"
          >
            Create one or sign in
          </Link>
          ; anything you already wrote on this device comes with you.
        </p>
      )}
    </SubPage>
  )
}
