import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { contactEmail, TextPage } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/faq')({
  head: () => ({
    meta: pageMeta(
      'Questions about Oriel',
      'Accounts, offline use, sharing, installing, exporting and privacy: answers to the questions people ask about Oriel.',
      { indexed: true },
    ),
  }),
  component: Faq,
})

const questions: { question: string; answer: ReactNode }[] = [
  {
    question: 'Do I need an account?',
    answer: (
      <p>
        No. Open <Link to="/app">the app</Link> and start writing; everything is
        saved in this browser. An account is only needed to sync between your
        devices and to share spaces with other people. When you create one, what
        you wrote before moves into it.
      </p>
    ),
  },
  {
    question: 'Does it really work offline?',
    answer: (
      <p>
        Yes. After the first visit, Oriel opens and works without a connection:
        you can capture, edit, check off and search. With an account, changes
        made offline are sent when the connection is back, and changes from
        others arrive then too.
      </p>
    ),
  },
  {
    question: 'Where are my notes stored?',
    answer: (
      <p>
        In a database inside your browser on this device. With an account, also
        on a server I run, so your other devices and the people you share with
        can receive them. Read the <Link to="/privacy">privacy policy</Link> for
        the details.
      </p>
    ),
  },
  {
    question: 'How do I install it like an app?',
    answer: (
      <ul>
        <li>
          Android (Chrome): open the menu and choose “Add to home screen” or
          “Install app”.
        </li>
        <li>iPhone and iPad (Safari): tap Share, then “Add to Home Screen”.</li>
        <li>
          Computer (Chrome or Edge): use the install icon in the address bar.
        </li>
      </ul>
    ),
  },
  {
    question: 'How does sharing work?',
    answer: (
      <p>
        With an account, create a shared space and invite people with a link (or
        by email). Each invite is for an editor, who can change things, or a
        viewer, who can only look. Each link works once and expires after 7
        days. Your personal space is never shared.
      </p>
    ),
  },
  {
    question: 'What happens when two people change the same thing?',
    answer: (
      <p>
        Each field keeps the latest change: if one person renames a list while
        another checks off an entry, both changes stay. If two people edit the
        same text at once, the one saved last wins.
      </p>
    ),
  },
  {
    question: 'Can I get my data out?',
    answer: (
      <p>
        Yes. Settings exports everything on the device as JSON, which Oriel can
        import again, or as Markdown, which opens in any notes app.
      </p>
    ),
  },
  {
    question: 'What happens when I sign out or delete my account?',
    answer: (
      <p>
        Signing out removes your notes from this device; they stay in your
        account. Deleting the account removes it, your personal space and every
        shared space only you use, on the server and on the device. A shared
        space others still use needs another owner first.
      </p>
    ),
  },
  {
    question: 'Does it cost anything?',
    answer: (
      <p>
        No. Oriel is a personal project without ads, and its code is open
        source.
      </p>
    ),
  },
  {
    question: 'Which browsers does it support?',
    answer: (
      <p>
        Oriel is built for current versions of Chrome, Edge, Firefox and Safari
        on phones and computers, and tested most in Chrome. Private or incognito
        windows may refuse to keep the local database.
      </p>
    ),
  },
]

function Faq() {
  return (
    <TextPage
      title="Questions"
      lead="What people ask about Oriel. Something missing? Write to me and I will add it."
    >
      <div className="flex flex-col">
        {questions.map(({ question, answer }) => (
          <details key={question} className="group border-b border-rule py-2">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm font-serif text-xl focus-visible:outline-2">
              {question}
              <span
                aria-hidden
                className="text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <div className="prose-text flex flex-col gap-3 pt-1 pb-4 text-muted-foreground">
              {answer}
            </div>
          </details>
        ))}
      </div>
      <p className="text-muted-foreground">
        Still curious? Write to{' '}
        <a
          href={`mailto:${contactEmail}`}
          className="underline underline-offset-4"
        >
          {contactEmail}
        </a>
        .
      </p>
    </TextPage>
  )
}
