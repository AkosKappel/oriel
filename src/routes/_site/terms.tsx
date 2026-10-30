import { createFileRoute, Link } from '@tanstack/react-router'
import { contactEmail, TextPage, TextSection } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/terms')({
  head: () => ({
    meta: pageMeta(
      'Terms of use · Oriel',
      'The terms for using Oriel: a free personal project, your content stays yours, fair use, and no guarantees.',
      { indexed: true },
    ),
  }),
  component: Terms,
})

function Terms() {
  return (
    <TextPage
      title="Terms of use"
      lead="Oriel is a free personal project. These terms keep it fair for everyone who uses it."
      updated="30 October 2026"
      englishOnly
    >
      <TextSection title="The service">
        <p>
          Oriel is provided by Ákos Kappel free of charge, as it is. You can use
          it without an account; an account adds sync and sharing. I may change,
          pause or end the service, and will give account holders reasonable
          notice before ending it so they can export their data.
        </p>
      </TextSection>

      <TextSection title="Your account">
        <ul>
          <li>Give a real email address and keep your password to yourself.</li>
          <li>You are responsible for what happens in your account.</li>
          <li>You can delete your account at any time on the account page.</li>
        </ul>
      </TextSection>

      <TextSection title="Your content">
        <p>
          What you write stays yours. You allow Oriel only what it needs to run:
          to store your content, sync it to your devices and show it to the
          members of the spaces you share it in. The{' '}
          <Link to="/privacy">privacy policy</Link> explains how data is
          handled.
        </p>
      </TextSection>

      <TextSection title="Fair use">
        <p>Please do not use Oriel to:</p>
        <ul>
          <li>store or share anything illegal;</li>
          <li>harass people, or send invites as spam;</li>
          <li>
            try to break into accounts or the server, overload it, or get around
            its limits.
          </li>
        </ul>
        <p>
          I may suspend or delete accounts that do, after a warning where that
          is reasonable.
        </p>
      </TextSection>

      <TextSection title="No guarantees">
        <p>
          I take care to keep Oriel working and your data safe, with daily
          backups, but I cannot promise it will always be available or free of
          mistakes. Keep your own copy of anything important: Settings exports
          everything at any time. To the extent the law allows, I am not liable
          for lost data or other damage from using Oriel. Nothing here limits
          rights you have as a consumer under the law.
        </p>
      </TextSection>

      <TextSection title="Changes and contact">
        <p>
          If these terms change, the new version will appear here with a new
          date. Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          .
        </p>
      </TextSection>
    </TextPage>
  )
}
