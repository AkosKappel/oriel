import { createFileRoute, Link } from '@tanstack/react-router'
import { contactEmail, TextPage, TextSection } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/privacy')({
  head: () => ({
    meta: pageMeta(
      'Privacy policy · Oriel',
      'What Oriel stores on your device and on its server, who else is involved, how long things are kept, and your rights.',
      { indexed: true },
    ),
  }),
  component: Privacy,
})

const mail = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>

function Privacy() {
  return (
    <TextPage
      title="Privacy policy"
      lead="Oriel is built to keep your notes on your device. This page explains what is stored where, who else is involved, and what you can do about it."
      updated="30 October 2026"
    >
      <TextSection title="In short">
        <ul>
          <li>Without an account, your notes stay in your browser.</li>
          <li>
            With an account, your notes and account details are stored on a
            server I run, to sync and share them.
          </li>
          <li>
            No ads, no tracking, no analytics services, no data sold or shared
            for marketing.
          </li>
          <li>
            Like any website, the server logs requests (including IP addresses)
            to keep the service running and secure.
          </li>
        </ul>
      </TextSection>

      <TextSection title="Who is responsible">
        <p>
          Oriel is run by Ákos Kappel, a private person, as a personal project.
          For anything about your data, write to {mail}.
        </p>
      </TextSection>

      <TextSection title="Using Oriel without an account">
        <p>
          Your notes, lists and tasks are saved in a database inside your
          browser (IndexedDB) on your device. Your theme and a few preferences
          are kept in the browser’s local storage, and the app’s files are
          cached so it opens offline. None of this is sent to me.
        </p>
        <p>
          Two things still reach the server: the requests your browser makes to
          load the pages (see <a href="#logs">server logs</a>), and, if the app
          runs into an error, a short error report with the error message, the
          page address and your browser’s user agent, so I can fix it.
        </p>
      </TextSection>

      <TextSection title="Using Oriel with an account">
        <p>When you create an account, the server stores:</p>
        <ul>
          <li>
            your name, email address and a one-way hash of your password (never
            the password itself);
          </li>
          <li>
            your sign-in sessions, each with its IP address, browser user agent
            and dates, so you can see and end them on the account page;
          </li>
          <li>
            your notes, lists, tasks and list entries, and who created,
            completed or deleted them;
          </li>
          <li>
            the spaces you belong to, your role in each, and open invites.
          </li>
          <li>
            in shared spaces, a log of who added, changed, checked or deleted
            what and when, shown to the space's members.
          </li>
        </ul>
        <p>
          Your devices download only the spaces you belong to. Members of a
          shared space see its content and the names of its members. Your email
          address is shown only to people you invite by email, as the address
          their reply goes to.
        </p>
        <p>
          The app and its sync service (PowerSync, run by me, not by the company
          that makes it) run on a server I operate myself. When you are signed
          in, a cookie keeps you signed in; it is needed for the service and is
          not used for anything else.
        </p>
      </TextSection>

      <TextSection title="Other services involved">
        <ul>
          <li>
            <strong>Tailscale</strong> (Tailscale Inc., USA) carries traffic to
            the server through its Funnel relays. The connection is encrypted
            between your browser and my server; the relays pass it on without
            being able to read it.
          </li>
          <li>
            <strong>Resend</strong> (Resend, Inc., USA) sends Oriel’s emails:
            password resets and invites you send by email. It receives the
            recipient’s address and the email’s content, and for invites your
            name and email address as the reply-to address.
          </li>
        </ul>
        <p>
          Both companies are based in the United States, so this data may be
          processed there. No other services receive your data.
        </p>
      </TextSection>

      <TextSection title="Server logs and security">
        <p id="logs">
          The web server logs each request: IP address, time, the page or file
          requested (secret links such as invites and password resets are
          masked), the response, the referring page and the browser’s user
          agent. These logs are kept for 12 months. I use them to run and debug
          the service, to see overall traffic (on my own server, without any
          third-party analytics), and to detect attacks: a security tool
          (CrowdSec) checks them for attack patterns and, when it flags an
          address as attacking, shares that address and the kind of attack with
          the CrowdSec network. The app also keeps a short technical log of
          requests (without IP addresses) and errors, which is overwritten as
          new entries arrive.
        </p>
      </TextSection>

      <TextSection title="How long data is kept">
        <ul>
          <li>
            Account data and content: until you delete them or the account.
          </li>
          <li>
            Items in the trash: deleted for good after 30 days, or sooner when
            you empty the trash.
          </li>
          <li>
            Database backups: one per day, each kept for 14 days, so deleted
            data disappears from backups within 14 days.
          </li>
          <li>
            The log of changes in a shared space: 90 days, and it goes with the
            item or entry it is about.
          </li>
          <li>Web server logs: 12 months.</li>
          <li>Data on your device: until you sign out or clear it.</li>
        </ul>
      </TextSection>

      <TextSection title="Why I may process it">
        <p>
          Under the GDPR, account data and content are processed to provide the
          service you signed up for (Article 6(1)(b)). Server logs and error
          reports are processed in my legitimate interest in running a secure
          and working service (Article 6(1)(f)).
        </p>
      </TextSection>

      <TextSection title="Your rights">
        <p>
          You can see, correct, export and delete your data, restrict or object
          to its processing, and complain to the data protection authority where
          you live. Most of this works in the app:
        </p>
        <ul>
          <li>
            Export everything as JSON or Markdown in{' '}
            <Link to="/settings">Settings</Link>.
          </li>
          <li>
            Change your name or password, end sessions on other devices, or
            delete your account on the account page.
          </li>
          <li>For anything else, or to change your email address: {mail}.</li>
        </ul>
      </TextSection>

      <TextSection title="Children">
        <p>
          Oriel is not meant for children under 16 to use with an account
          without a parent’s consent.
        </p>
      </TextSection>

      <TextSection title="Changes">
        <p>
          If this policy changes, the new version will appear here with a new
          date.
        </p>
      </TextSection>
    </TextPage>
  )
}
