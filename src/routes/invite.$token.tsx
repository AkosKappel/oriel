import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { Button } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { useAccount } from '#/lib/account'
import { m } from '#/paraglide/messages.js'
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
  // undefined while asking the server; 'failed' when it could not be asked (offline, server down).
  const [invite, setInvite] = useState<Invite | 'failed' | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const check = useCallback(() => {
    setInvite(undefined)
    describeInvite({ data: { token } }).then(setInvite, (error: unknown) => {
      console.error('Could not check the invite', error)
      setInvite('failed')
    })
  }, [token])
  useEffect(check, [check])

  if (invite === undefined) {
    return (
      <SubPage>
        <p role="status" className="text-sm text-muted-foreground">
          {m.invite_checking()}
        </p>
      </SubPage>
    )
  }

  if (invite === 'failed') {
    return (
      <SubPage>
        <h1 className="font-serif text-3xl italic">
          {m.invite_check_failed()}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {navigator.onLine ? m.invite_server() : m.invite_offline()}{' '}
          <Button
            onPress={check}
            className="rounded-sm text-foreground underline underline-offset-4 data-focus-visible:outline-2"
          >
            {m.error_try_again()}
          </Button>
        </p>
      </SubPage>
    )
  }

  if (invite?.state !== 'open') {
    return (
      <SubPage>
        <h1 className="font-serif text-3xl italic">
          {!invite
            ? m.invite_broken()
            : invite.state === 'used'
              ? m.invite_already_used()
              : m.invite_expired()}
        </h1>
        <p className="text-sm text-muted-foreground">{m.invite_ask_new()}</p>
      </SubPage>
    )
  }

  const { spaceName } = invite

  async function join() {
    setBusy(true)
    try {
      await acceptInvite({ data: { token } })
      toast(m.invite_joined({ space: spaceName }))
      await navigate({ to: '/app' })
    } catch (error) {
      toast(error instanceof Error ? error.message : m.invite_join_failed())
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubPage>
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {m.invite_invites_you({ inviter: invite.inviterName })}
        </p>
        <h1 className="font-serif text-4xl tracking-tight">
          {invite.spaceName}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {invite.role === 'viewer' ? m.invite_can_view() : m.invite_can_edit()}
        </p>
      </div>
      {account ? (
        <Button
          onPress={() => void join()}
          isPending={busy}
          className="h-11 w-fit rounded-sm bg-foreground px-5 text-sm text-background data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-pending:opacity-60"
        >
          {m.invite_join({ space: invite.spaceName })}
        </Button>
      ) : (
        <p className="max-w-sm text-sm">
          {m.invite_needs_account()}{' '}
          <Link
            to="/sign-in"
            search={{ redirect: `/invite/${token}` }}
            className="underline underline-offset-4"
          >
            {m.invite_create_or_sign_in()}
          </Link>
          {m.invite_comes_with_you()}
        </p>
      )}
    </SubPage>
  )
}
