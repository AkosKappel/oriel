import { createFileRoute } from '@tanstack/react-router'
import { contactEmail, TextPage, TextSection } from '#/components/site-shell'
import { pageMeta } from '#/lib/seo'

export const Route = createFileRoute('/_site/accessibility')({
  head: () => ({
    meta: pageMeta(
      'Accessibility · Oriel',
      'How Oriel works with a keyboard, screen readers and reduced motion, what is checked, and what is known to be missing.',
      { indexed: true },
    ),
  }),
  component: Accessibility,
})

function Accessibility() {
  return (
    <TextPage
      title="Accessibility"
      lead="Oriel should work for everyone, with a mouse, a keyboard, a touch screen or a screen reader. The goal is the WCAG 2.2 AA level."
      updated="30 October 2026"
    >
      <TextSection title="What is in place">
        <ul>
          <li>
            Everything works with a keyboard. Lists reorder with the arrow keys
            as well as by dragging, j and k move through items, Escape closes
            the open item, and Ctrl+K opens a command palette.
          </li>
          <li>
            Screen readers hear what changes: entry counts, moved entries, saved
            items with Undo, and what other members of a shared space add or
            finish.
          </li>
          <li>
            Focus moves to the right place after opening, closing or moving
            things.
          </li>
          <li>
            Text and controls meet the contrast requirements in the light and
            the dark theme.
          </li>
          <li>Animations turn off when the device asks for reduced motion.</li>
          <li>
            Pages work zoomed and from 320 pixels wide without sideways
            scrolling, and text in other scripts, including right-to-left ones,
            reads in its own direction.
          </li>
        </ul>
      </TextSection>

      <TextSection title="How it is checked">
        <p>
          Every change is tested automatically with axe in the end-to-end tests
          on desktop and mobile layouts, and Lighthouse must score 100 for
          accessibility before a version is released. Interactive controls are
          built on React Aria, which follows the ARIA practices for keyboard and
          screen reader use.
        </p>
      </TextSection>

      <TextSection title="Known gaps">
        <ul>
          <li>
            Oriel has not yet been tested by people using screen readers day to
            day, or with VoiceOver on a real iPhone.
          </li>
          <li>
            Swiping a row to finish, archive or delete it has no direct keyboard
            equivalent; the same actions are on the item page.
          </li>
        </ul>
      </TextSection>

      <TextSection title="Tell me what does not work">
        <p>
          If something is hard or impossible to use, please write to{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a> and describe
          what you tried and with which device or assistive technology. I will
          reply and try to fix it.
        </p>
      </TextSection>
    </TextPage>
  )
}
