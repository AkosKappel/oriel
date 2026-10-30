import { createFileRoute, Link } from '@tanstack/react-router'
import {
  contactEmail,
  repositoryUrl,
  TextPage,
  TextSection,
} from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/about')({
  head: () => ({
    meta: pageMeta(
      'About Oriel',
      'Oriel keeps notes, lists and tasks on your device first, works offline, and syncs and shares them with the people you choose.',
      { indexed: true },
    ),
  }),
  component: About,
})

function About() {
  return (
    <TextPage
      title="About Oriel"
      lead="Oriel is one calm place for notes, lists and tasks. Everything is saved on your device first, so it opens instantly and works without a connection. With an account it syncs between your devices, and shared spaces keep a household or a team on the same list as it changes."
    >
      <TextSection title="What it does">
        <ul>
          <li>
            Quick capture: type a line and press Enter. A first line becomes the
            title, and “Groceries: milk, eggs, bread” becomes a list. On phones
            that support it, you can also dictate.
          </li>
          <li>Notes in Markdown, shown formatted and edited as plain text.</li>
          <li>
            Lists to check off, reorder by dragging or with the keyboard, and
            reuse; entries from earlier lists are suggested as you type.
          </li>
          <li>
            Tasks with a priority, a status (to do, in progress, waiting) and a
            due day, with Today and Upcoming views.
          </li>
          <li>
            Pin, archive and a trash that keeps deleted things for 30 days, with
            Undo right after deleting, clearing or moving things.
          </li>
          <li>
            Search across titles, text and list entries, on the device and
            offline, and a command palette (Ctrl+K) on a keyboard.
          </li>
          <li>
            Shared spaces with invite links, and roles for who may edit and who
            may only look. You see who added and who checked something off.
          </li>
          <li>
            Installable as an app, in a light and a dark theme, with the list
            and the open item side by side on a wide screen.
          </li>
          <li>Export to JSON or Markdown at any time, and import JSON back.</li>
        </ul>
      </TextSection>

      <TextSection title="Your data">
        <ul>
          <li>
            No account is needed. Without one, your notes never leave your
            device.
          </li>
          <li>
            With an account, your notes sync to a server I run myself. Each
            device receives only the spaces its user belongs to, and the server
            checks every change against your role before saving it.
          </li>
          <li>
            No ads, no tracking scripts, no third-party analytics. A cookie only
            keeps you signed in.
          </li>
          <li>
            Signing out removes your notes from the device. Deleting the account
            removes it, and the spaces only you use, from the server too.
          </li>
        </ul>
        <p>
          The details are in the <Link to="/privacy">privacy policy</Link>.
        </p>
      </TextSection>

      <TextSection title="How it is built">
        <p>
          Oriel is a study of local-first software: a SQLite database in the
          browser, kept in step with PostgreSQL by a sync service, with every
          permission checked on the server. It is built with TanStack Start,
          TanStack DB, PowerSync and Better Auth, and runs on a home server.
        </p>
      </TextSection>

      <TextSection title="Who made it">
        <p>
          Oriel is made by Ákos Kappel. The code is open on{' '}
          <a href={repositoryUrl}>GitHub</a>, and questions or ideas are welcome
          at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
        </p>
      </TextSection>
    </TextPage>
  )
}
