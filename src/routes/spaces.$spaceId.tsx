import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
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
import { ChoiceGroup } from '#/components/ui/choice-group'
import { TextField } from '#/components/ui/text-field'
import type { Member, MemberRole } from '#/data/schema'
import { useAccount } from '#/lib/account'
import { formatShortDate } from '#/lib/dates'
import { type SpaceView, useSpaces } from '#/lib/spaces'
import {
  createInvite,
  deleteSpace,
  listInvites,
  removeMember,
  renameSpace,
  revokeInvite,
  setMemberRole,
} from '#/server/sharing-functions'

export const Route = createFileRoute('/spaces/$spaceId')({
  ssr: false,
  component: SpacePage,
})

const roleChoices = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] as const

const textButton =
  'rounded-sm py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-focus-visible:outline-2 motion-reduce:transition-none'

/** Runs a sharing action and shows its error, which is written for the user. */
async function attempt(action: () => Promise<unknown>, done?: string) {
  try {
    await action()
    if (done) toast(done)
    return true
  } catch (error) {
    toast(error instanceof Error ? error.message : 'That did not work.')
    return false
  }
}

function SpacePage() {
  const { spaceId } = Route.useParams()
  const { byId, isLoading } = useSpaces()
  const space = byId.get(spaceId)

  if (isLoading) return null
  if (!space) {
    return (
      <SubPage back="/spaces">
        <p className="font-serif text-2xl italic">This space is not here.</p>
        <p className="text-sm text-muted-foreground">
          You may have left it, or it is still on its way to this device.
        </p>
      </SubPage>
    )
  }

  const owner = space.role === 'owner'
  // An owner can leave only while another owner stays; the last owner deletes the space instead.
  const otherOwners =
    space.members.filter((member) => member.role === 'owner').length > 1
  return (
    <SubPage back="/spaces">
      <SpaceName space={space} />
      {space.personal ? (
        <p className="max-w-sm font-serif text-lg leading-relaxed">
          Your personal space is only yours. To share, make a shared space and
          move notes and lists into it.
        </p>
      ) : (
        <>
          <Members space={space} />
          {owner && <Invites spaceId={space.id} />}
          <div className="flex flex-wrap gap-x-6">
            {(!owner || otherOwners) && <Leave space={space} action="leave" />}
            {owner && <Leave space={space} action="delete" />}
          </div>
        </>
      )}
    </SubPage>
  )
}

function SpaceName({ space }: { space: SpaceView }) {
  if (space.role !== 'owner' || space.personal) {
    return <h1 className="font-serif text-4xl tracking-tight">{space.name}</h1>
  }
  return (
    <input
      // Remounts when the name changes elsewhere, so it never shows stale text.
      key={space.name}
      defaultValue={space.name}
      aria-label="Space name"
      maxLength={60}
      onBlur={(event) => {
        const name = event.currentTarget.value.trim()
        if (!name || name === space.name) {
          event.currentTarget.value = space.name
          return
        }
        void attempt(() => renameSpace({ data: { spaceId: space.id, name } }))
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="w-full bg-transparent font-serif text-4xl tracking-tight outline-none"
    />
  )
}

function Members({ space }: { space: SpaceView }) {
  const account = useAccount()
  const owner = space.role === 'owner'

  return (
    <section aria-labelledby="members" className="flex flex-col gap-2">
      <h2 id="members" className="text-xs text-muted-foreground">
        Members
      </h2>
      <ul className="flex flex-col gap-3">
        {space.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.user_id === account?.userId}
            canManage={owner}
          />
        ))}
      </ul>
    </section>
  )
}

function MemberRow({
  member,
  isMe,
  canManage,
}: {
  member: Member
  isMe: boolean
  canManage: boolean
}) {
  const label = roleChoices.find(
    (choice) => choice.value === member.role,
  )?.label
  return (
    <li className="flex flex-col">
      <span className="font-serif text-lg">
        {member.member_name}
        {isMe && <span className="text-muted-foreground"> (you)</span>}
      </span>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-x-4">
          <ChoiceGroup
            label={`Role of ${member.member_name}`}
            choices={roleChoices}
            value={member.role}
            onChange={(role: MemberRole) =>
              void attempt(() =>
                setMemberRole({
                  data: {
                    spaceId: member.space_id,
                    memberId: member.user_id,
                    role,
                  },
                }),
              )
            }
          />
          {!isMe && (
            <Button
              onPress={() =>
                void attempt(
                  () =>
                    removeMember({
                      data: {
                        spaceId: member.space_id,
                        memberId: member.user_id,
                      },
                    }),
                  `${member.member_name} was removed.`,
                )
              }
              className={`${textButton} hover:text-destructive`}
            >
              Remove
            </Button>
          )}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </li>
  )
}

type OpenInvite = {
  id: string
  role: string
  email: string | null
  expiresAt: string
}

function Invites({ spaceId }: { spaceId: string }) {
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [open, setOpen] = useState<OpenInvite[]>([])

  const refresh = useCallback(() => {
    listInvites({ data: { spaceId } }).then(setOpen, () => setOpen([]))
  }, [spaceId])
  useEffect(refresh, [refresh])

  async function create(event: FormEvent) {
    event.preventDefault()
    const to = email.trim() || undefined
    await attempt(async () => {
      const { token, emailed } = await createInvite({
        data: { spaceId, role, email: to },
      })
      setLink(`${window.location.origin}/invite/${token}`)
      setSentTo(emailed ? (to ?? null) : null)
      if (to && !emailed)
        toast('The email could not be sent. Share the link instead.')
      setEmail('')
      refresh()
    })
  }

  async function share(url: string) {
    if (navigator.share) {
      await navigator.share({ title: 'Join me on Oriel', url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url)
    toast('Link copied')
  }

  return (
    <section aria-labelledby="invite" className="flex flex-col gap-2">
      <h2 id="invite" className="text-xs text-muted-foreground">
        Invite someone
      </h2>
      <ChoiceGroup
        label="They can"
        showLabel
        choices={[
          { value: 'editor', label: 'Edit' },
          { value: 'viewer', label: 'Only view' },
        ]}
        value={role}
        onChange={setRole}
      />
      <Form
        onSubmit={(event) => void create(event)}
        className="flex flex-col gap-3"
      >
        <TextField
          label="Their email (optional)"
          type="email"
          autoComplete="off"
          value={email}
          onChange={setEmail}
        />
        <Button
          type="submit"
          className="h-11 w-fit rounded-sm bg-foreground px-4 text-sm text-background data-focus-visible:outline-2 data-focus-visible:outline-offset-2"
        >
          {email.trim() ? 'Send invite' : 'Create invite link'}
        </Button>
      </Form>
      {link && (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-xs text-muted-foreground">
            {sentTo ? `Invite sent to ${sentTo}. ` : ''}
            One person can join with this link within 7 days. It is shown only
            now.
          </p>
          <div className="flex items-center gap-3">
            <input
              readOnly
              value={link}
              aria-label="Invite link"
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 border-b-[1.5px] border-foreground/25 bg-transparent font-mono text-xs outline-none"
            />
            <Button onPress={() => void share(link)} className={textButton}>
              {typeof navigator.share === 'function' ? 'Share' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
      {open.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {open.map((invite) => (
            <li
              key={invite.id}
              className="flex items-center justify-between text-sm text-muted-foreground"
            >
              <span>
                {invite.email ?? 'Open link'} ·{' '}
                {invite.role === 'viewer' ? 'view only' : 'can edit'} · until{' '}
                {formatShortDate(invite.expiresAt)}
              </span>
              <Button
                onPress={() =>
                  void attempt(
                    () => revokeInvite({ data: { inviteId: invite.id } }),
                    'Invite link revoked',
                  ).then(refresh)
                }
                className={textButton}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Leave({
  space,
  action,
}: {
  space: SpaceView
  action: 'leave' | 'delete'
}) {
  const account = useAccount()
  const navigate = useNavigate()
  const deleting = action === 'delete'

  async function confirm(close: () => void) {
    const left = await attempt(
      () =>
        deleting
          ? deleteSpace({ data: { spaceId: space.id } })
          : removeMember({
              data: { spaceId: space.id, memberId: account?.userId ?? '' },
            }),
      deleting ? `${space.name} was deleted.` : `You left ${space.name}.`,
    )
    if (left) {
      close()
      await navigate({ to: '/spaces' })
    }
  }

  return (
    <DialogTrigger>
      <Button className={`${textButton} w-fit hover:text-destructive`}>
        {deleting ? 'Delete space' : 'Leave space'}
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
                  {deleting ? `Delete ${space.name}?` : `Leave ${space.name}?`}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {deleting
                    ? 'Everything in it is deleted for every member. This cannot be undone.'
                    : 'Its notes and lists disappear from your devices. An owner can invite you again.'}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    autoFocus
                    className={`${textButton} px-4`}
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => void confirm(close)}
                    className="h-11 rounded-sm bg-destructive px-4 text-sm text-background data-focus-visible:outline-2"
                  >
                    {deleting ? 'Delete' : 'Leave'}
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
