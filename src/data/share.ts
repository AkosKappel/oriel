import { titleSchema } from './schema'

type Shared = { title?: string; text?: string; url?: string }

const maxTitle = 200

/**
 * Builds a note from what another app shared. Apps fill the fields differently (Android often puts
 * the link in `text`), so the title falls back to the first line of the text, then the link.
 */
export function sharedNote({ title = '', text = '', url = '' }: Shared) {
  const [firstLine = '', ...otherLines] = text.trim().split('\n')
  const heading = title.trim() || firstLine.trim() || url.trim()
  if (!heading) return null

  const body = [title.trim() ? text : otherLines.join('\n'), url]
    .map((part) => part.trim())
    .filter((part) => part && part !== heading)
    .join('\n\n')

  const safeTitle = titleSchema.safeParse(heading).success
    ? heading
    : `${heading.slice(0, maxTitle - 1)}…`
  return { type: 'note' as const, title: safeTitle, body }
}
