import { createFileRoute, Link, ScriptOnce } from '@tanstack/react-router'
import {
  Keyboard,
  ListChecks,
  type LucideIcon,
  ShieldCheck,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react'
import { primaryButton } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/')({
  head: () => ({
    meta: pageMeta(
      'Oriel: notes, lists and tasks that work offline',
      'One calm place for notes, shopping lists and tasks. Opens instantly, works without a connection, and keeps a household on the same list. No account needed to start.',
      { indexed: true },
    ),
  }),
  component: Home,
})

// A device that has used Oriel before goes straight to its notebook when it opens this address
// itself (a bookmark, the old installed app); links within the site still show this page.
const returningVisitor = `try{var r=document.referrer,s=r&&new URL(r).origin===location.origin;if(!s&&(localStorage.getItem('oriel.account')||localStorage.getItem('oriel.used')))location.replace('/app')}catch(e){}`

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: 'Capture in a second',
    text: 'Type a line and press Enter. “Groceries: milk, eggs, bread” becomes a list, and a pasted paragraph becomes a note.',
  },
  {
    icon: WifiOff,
    title: 'Works without a connection',
    text: 'Everything is saved on your device first, so Oriel opens instantly in a basement shop, on a train or on a plane.',
  },
  {
    icon: Users,
    title: 'Shared with your people',
    text: 'Invite family or friends to a space. Checked items show up on every phone moments later, with who checked them.',
  },
  {
    icon: ListChecks,
    title: 'Notes, lists and tasks',
    text: 'Markdown notes, lists you reorder and reuse, and tasks with priorities, statuses and due days.',
  },
  {
    icon: Keyboard,
    title: 'Fast on a keyboard',
    text: 'Search everything, even offline. Ctrl+K jumps to any item or command, and j and k move through the list.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'No account needed, no ads and no trackers. Export everything to JSON or Markdown whenever you like.',
  },
]

const steps = [
  {
    title: 'Write on your device',
    text: 'Notes live in a database inside your browser. Nothing waits for a server, and nothing leaves the device until you create an account.',
  },
  {
    title: 'Sync when you are online',
    text: 'With an account, changes travel to your other devices in the background. Offline edits are sent as soon as the connection is back.',
  },
  {
    title: 'Share a space',
    text: 'Owners invite people as editors or viewers. The server checks every change against those roles before anyone else sees it.',
  },
]

function Home() {
  return (
    <>
      <ScriptOnce>{returningVisitor}</ScriptOnce>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-20">
        <div className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            Notes, lists and tasks
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            One calm place for the things you don’t want to forget.
          </h1>
          <p className="max-w-xl font-serif text-xl leading-relaxed text-muted-foreground">
            Oriel opens instantly, works without a connection, and keeps a
            household on the same shopping list. Start writing right away; an
            account is only for syncing and sharing.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/app" className={primaryButton}>
              Start writing
            </Link>
            <Link
              to="/sign-in"
              className="rounded-sm px-1 py-2 text-sm underline underline-offset-4 hover:text-primary focus-visible:outline-2"
            >
              Create an account
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Free, no sign-up needed. Install it on your phone or computer like
            an app.
          </p>
        </div>
        <picture>
          <source
            srcSet="/screenshots/app-dark.jpg"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/screenshots/app-light.jpg"
            alt="Oriel on a wide screen: the list of notes, lists and tasks on the left and an open grocery list beside it"
            width={1280}
            height={800}
            className="w-full rounded-md shadow-xl ring-1 ring-rule"
          />
        </picture>
      </section>

      <section
        aria-labelledby="features"
        className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32"
      >
        <h2
          id="features"
          className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl"
        >
          Everything the fridge door list does, and what it can’t.
        </h2>
        <ul className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex flex-col gap-2">
              <Icon aria-hidden className="size-6 text-primary" />
              <h3 className="font-serif text-xl">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="how"
        className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32"
      >
        <h2
          id="how"
          className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl"
        >
          Local first, shared when you want.
        </h2>
        <ol className="mt-12 grid gap-10 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-serif text-4xl text-primary">
                {index + 1}
              </span>
              <h3 className="font-serif text-xl">{step.title}</h3>
              <p className="text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-muted-foreground">
          Curious how it is built?{' '}
          <Link to="/about" className="underline underline-offset-4">
            Read about Oriel
          </Link>{' '}
          or the{' '}
          <Link to="/faq" className="underline underline-offset-4">
            questions people ask
          </Link>
          .
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-8 lg:pt-32">
        <div className="flex flex-col items-start gap-6 rounded-md bg-wash px-6 py-12 sm:px-12">
          <h2 className="max-w-2xl font-serif text-3xl tracking-tight sm:text-4xl">
            Your next shopping list is one line away.
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Nothing to install first and nothing to sign up for. What you write
            stays on this device until you decide otherwise.
          </p>
          <Link to="/app" className={primaryButton}>
            Open Oriel
          </Link>
        </div>
      </section>
    </>
  )
}
