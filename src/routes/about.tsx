import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Logo } from '#/components/logo'
import { SubPage } from '#/components/sub-page'

// Public and static: rendered on the server, no local database.
export const Route = createFileRoute('/about')({
  head: () => ({
    meta: [
      { title: 'About Oriel' },
      {
        name: 'description',
        content:
          'Oriel keeps notes, lists and tasks on your device first, works offline, and syncs and shares them with the people you choose.',
      },
    ],
  }),
  component: About,
})

const link = 'text-foreground underline underline-offset-4'

function About() {
  return (
    <SubPage back="/">
      <div className="flex flex-col gap-3">
        <Logo className="size-12 text-primary" />
        <h1 className="font-serif text-4xl tracking-tight">About Oriel</h1>
        <p className="max-w-prose font-serif text-lg leading-relaxed">
          Oriel is one calm place for notes, lists and tasks. Everything is
          saved on your device first, so it opens instantly and works without a
          connection. With an account it syncs between your devices, and shared
          spaces keep a household or a team on the same list as it changes.
        </p>
      </div>

      <Section title="What it does">
        <Bullets>
          <li>
            Quick capture: type a line and press Enter. A first line becomes the
            title, and “Groceries: milk, eggs, bread” becomes a list.
          </li>
          <li>Notes in Markdown, shown formatted and edited as plain text.</li>
          <li>
            Lists to check off, reorder by dragging or with the keyboard, and
            reuse; entries from earlier lists are suggested as you type.
          </li>
          <li>
            Tasks with a priority and a status (to do, in progress, waiting).
          </li>
          <li>
            Pin, archive and a trash that keeps deleted things for 30 days, with
            Undo right after deleting, clearing or moving things.
          </li>
          <li>
            Search across titles, text and list entries, on the device and
            offline.
          </li>
          <li>
            Shared spaces with invite links, and roles for who may edit and who
            may only look. You see who checked something off.
          </li>
          <li>
            Installable as an app, with a light and a dark theme, and on a wide
            screen the list and the open item side by side.
          </li>
          <li>Export to JSON or Markdown at any time, and import JSON back.</li>
        </Bullets>
      </Section>

      <Section title="Your data">
        <Bullets>
          <li>
            No account is needed. Without one, nothing leaves your device.
          </li>
          <li>
            With an account, your notes sync to a server I run myself. Each
            device receives only the spaces its user belongs to, and the server
            checks every change against your role before saving it.
          </li>
          <li>
            Passwords are stored only as hashes. Members of your spaces see your
            name; your email address goes only to people you invite by email, as
            the address to reply to.
          </li>
          <li>
            No ads, no tracking scripts, no third-party analytics. Cookies only
            keep you signed in.
          </li>
          <li>
            Signing out removes your notes from the device. Deleting the account
            removes it, and the spaces only you use, from the server too.
          </li>
        </Bullets>
      </Section>

      <Section title="Try it">
        <p className="max-w-prose text-sm text-muted-foreground">
          <Link to="/" className={link}>
            Start writing
          </Link>{' '}
          right away, or{' '}
          <Link to="/sign-in" className={link}>
            create an account
          </Link>{' '}
          to sync and share.
        </p>
      </Section>

      <Section title="Who made it">
        <p className="max-w-prose text-sm text-muted-foreground">
          Oriel is built by Ákos Kappel as a study of local-first apps: a
          database in the browser, live sync from PostgreSQL, and sharing with
          permissions checked on the server. The code is open on{' '}
          <a href="https://github.com/AkosKappel/oriel" className={link}>
            GitHub
          </a>
          .
        </p>
      </Section>
    </SubPage>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children}
    </section>
  )
}

function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 font-serif text-lg leading-relaxed marker:text-muted-foreground">
      {children}
    </ul>
  )
}
