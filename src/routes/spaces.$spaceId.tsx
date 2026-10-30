import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
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
import { type ActivitySentence, describeActivity } from '#/lib/activity'
import { formatShortDate, formatWhen } from '#/lib/dates'
import { type SpaceView, useSpaces } from '#/lib/spaces'
import { m } from '#/paraglide/messages.js'
import {
  createInvite,
  deleteSpace,
  listActivity,
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

const roleChoices = () =>
  (['owner', 'editor', 'viewer'] as const).map((role) => ({
    value: role,
    label: m.role({ role }),
  }))

const textButton =
  'rounded-sm py-2 text-sm text-muted-foreground transition-colors hover:text-foreground data-focus-visible:outline-2 motion-reduce:transition-none'

/** Runs a sharing action and shows its error, which is written for the user. */
async function attempt(action: () => Promise<unknown>, done?: string) {
  try {
    await action()
    if (done) toast(done)
    return true
  } catch (error) {
    toast(error instanceof Error ? error.message : m.failed_generic())
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
        <p className="font-serif text-2xl italic">{m.space_not_here()}</p>
        <p className="text-sm text-muted-foreground">
          {m.space_not_here_explain()}
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
          {m.space_personal_explain()}
        </p>
      ) : (
        <>
          <Members space={space} />
          {owner && <Invites spaceId={space.id} />}
          <RecentChanges spaceId={space.id} />
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
    <>
      {/* The name is edited in place; the heading keeps the page outline for screen readers. */}
      <h1 className="sr-only">{space.name}</h1>
      <input
        // Remounts when the name changes elsewhere, so it never shows stale text.
        key={space.name}
        defaultValue={space.name}
        aria-label={m.space_name()}
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
    </>
  )
}

function Members({ space }: { space: SpaceView }) {
  const account = useAccount()
  const owner = space.role === 'owner'

  return (
    <section aria-labelledby="members" className="flex flex-col gap-2">
      <h2 id="members" className="text-xs text-muted-foreground">
        {m.space_members()}
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
  const label = m.role({ role: member.role })
  return (
    <li className="flex flex-col">
      <span className="font-serif text-lg">
        {member.member_name}
        {isMe && <span className="text-muted-foreground"> (you)</span>}
      </span>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-x-4">
          <ChoiceGroup
            label={m.space_role_of({ name: member.member_name })}
            choices={roleChoices()}
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
              {m.space_remove()}
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
      if (to && !emailed) toast(m.space_email_failed())
      setEmail('')
      refresh()
    })
  }

  async function share(url: string) {
    if (navigator.share) {
      await navigator
        .share({ title: m.space_share_title(), url })
        .catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url)
    toast(m.space_link_copied())
  }

  return (
    <section aria-labelledby="invite" className="flex flex-col gap-2">
      <h2 id="invite" className="text-xs text-muted-foreground">
        {m.space_invite()}
      </h2>
      <ChoiceGroup
        label={m.space_they_can()}
        showLabel
        choices={[
          { value: 'editor', label: m.space_can_edit() },
          { value: 'viewer', label: m.space_only_view() },
        ]}
        value={role}
        onChange={setRole}
      />
      <Form
        onSubmit={(event) => void create(event)}
        className="flex flex-col gap-3"
      >
        <TextField
          label={m.space_their_email()}
          type="email"
          autoComplete="off"
          value={email}
          onChange={setEmail}
        />
        <Button
          type="submit"
          className="h-11 w-fit rounded-sm bg-foreground px-4 text-sm text-background data-focus-visible:outline-2 data-focus-visible:outline-offset-2"
        >
          {email.trim() ? m.space_send_invite() : m.space_create_link()}
        </Button>
      </Form>
      {link && (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-xs text-muted-foreground">
            {sentTo ? `${m.space_invite_sent({ email: sentTo })} ` : ''}
            {m.space_link_note()}
          </p>
          <div className="flex items-center gap-3">
            <input
              readOnly
              value={link}
              aria-label={m.space_invite_link()}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 border-b-[1.5px] border-foreground/25 bg-transparent font-mono text-xs outline-none"
            />
            <Button onPress={() => void share(link)} className={textButton}>
              {typeof navigator.share === 'function'
                ? m.share()
                : m.space_copy()}
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
                {m.space_invite_line({
                  who: invite.email ?? m.space_open_link(),
                  role: invite.role,
                  date: formatShortDate(invite.expiresAt),
                })}
              </span>
              <Button
                onPress={() =>
                  void attempt(
                    () => revokeInvite({ data: { inviteId: invite.id } }),
                    m.space_invite_revoked(),
                  ).then(refresh)
                }
                className={textButton}
              >
                {m.space_revoke()}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentChanges({ spaceId }: { spaceId: string }) {
  // Undefined while loading; the log lives on the server only.
  const [sentences, setSentences] = useState<ActivitySentence[] | 'offline'>()

  useEffect(() => {
    listActivity({ data: { spaceId } }).then(
      (lines) => setSentences(describeActivity(lines)),
      () => setSentences('offline'),
    )
  }, [spaceId])

  if (sentences === undefined) return null
  return (
    <section aria-labelledby="changes" className="flex flex-col gap-2">
      <h2 id="changes" className="text-xs text-muted-foreground">
        {m.space_recent()}
      </h2>
      {sentences === 'offline' ? (
        <p className="text-sm text-muted-foreground">
          {m.space_recent_offline()}
        </p>
      ) : sentences.length === 0 ? (
        <p className="text-sm text-muted-foreground">{m.space_recent_none()}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sentences.map((sentence) => (
            <li key={sentence.key} className="font-serif text-base">
              {sentence.before}{' '}
              <Link
                to="/items/$itemId"
                params={{ itemId: sentence.itemId }}
                className="underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
              >
                {sentence.title}
              </Link>
              {sentence.after && ` ${sentence.after}`}{' '}
              <time
                dateTime={sentence.at}
                className="font-sans text-xs text-muted-foreground"
              >
                {formatWhen(sentence.at)}
              </time>
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
      deleting
        ? m.space_deleted({ space: space.name })
        : m.space_left({ space: space.name }),
    )
    if (left) {
      close()
      await navigate({ to: '/spaces' })
    }
  }

  return (
    <DialogTrigger>
      <Button className={`${textButton} w-fit hover:text-destructive`}>
        {deleting ? m.space_delete() : m.space_leave()}
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
                  {deleting
                    ? m.space_delete_title({ space: space.name })
                    : m.space_leave_title({ space: space.name })}
                </Heading>
                <p className="text-sm text-muted-foreground">
                  {deleting
                    ? m.space_delete_explain()
                    : m.space_leave_explain()}
                </p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onPress={close}
                    autoFocus
                    className={`${textButton} px-4`}
                  >
                    {m.cancel()}
                  </Button>
                  <Button
                    onPress={() => void confirm(close)}
                    className="h-11 rounded-sm bg-destructive px-4 text-sm text-background data-focus-visible:outline-2"
                  >
                    {deleting
                      ? m.space_delete_button()
                      : m.space_leave_button()}
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
