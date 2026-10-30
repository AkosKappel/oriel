import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button, Form } from 'react-aria-components'
import { toast } from 'sonner'
import { SubPage } from '#/components/sub-page'
import { TextField } from '#/components/ui/text-field'
import { useAccount } from '#/lib/account'
import { useSpaces } from '#/lib/spaces'
import { m } from '#/paraglide/messages.js'
import { createSpace } from '#/server/sharing-functions'

export const Route = createFileRoute('/spaces/')({
  ssr: false,
  component: SpacesPage,
})

function SpacesPage() {
  const account = useAccount()
  const { spaces } = useSpaces()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  if (!account) return <Navigate to="/sign-in" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await createSpace({ data: { name } })
      setName('')
      toast(m.spaces_ready({ name: name.trim() }))
    } catch (error) {
      toast(error instanceof Error ? error.message : m.spaces_create_failed())
    } finally {
      setBusy(false)
    }
  }

  return (
    <SubPage back="/account">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-4xl tracking-tight">
          {m.spaces_title()}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {m.spaces_explain()}
        </p>
      </div>

      <ul className="flex flex-col">
        {spaces.map((space) => (
          <li key={space.id}>
            <Link
              to="/spaces/$spaceId"
              params={{ spaceId: space.id }}
              className="flex min-h-12 flex-col justify-center rounded-sm py-2.5 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <span className="font-serif text-[1.1875rem] leading-snug">
                {space.name}
              </span>
              <span className="text-sm text-muted-foreground">
                {space.personal
                  ? m.spaces_only_you()
                  : m.spaces_role_members({
                      role: m.role({ role: space.role }),
                      count: space.members.length,
                    })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Form onSubmit={submit} className="flex max-w-sm items-end gap-3">
        <div className="flex-1">
          <TextField
            label={m.spaces_new()}
            name="name"
            value={name}
            onChange={setName}
            maxLength={60}
            isRequired
          />
        </div>
        <Button
          type="submit"
          isPending={busy}
          className="mb-6 h-11 rounded-sm bg-foreground px-4 text-sm text-background data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-pending:opacity-60"
        >
          {m.spaces_create()}
        </Button>
      </Form>
    </SubPage>
  )
}
