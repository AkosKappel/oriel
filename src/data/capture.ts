import type { ItemType } from './schema'

export type CaptureDraft = {
  type: ItemType
  title: string
  body: string
  entries: string[]
}

const bullet = /^(?:[-*•]|\[ ?\]|\d+[.)])\s*/

/** Removes a leading bullet, number or checkbox from a pasted or typed list line. */
export const stripBullet = (line: string) => line.replace(bullet, '')

// "Groceries: milk, eggs" but not "10:30": the colon must be followed by a space.
const inlineList = /^(.+?):\s+(.+)$/
const longLine = 200
const shortTitle = 60

function shorten(line: string) {
  const cut = line.slice(0, shortTitle)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Turns free text from the capture field into an item. The first line is the title; further lines
 * become the body of a note or task, or the entries of a list. A one-line list can be written as
 * "Groceries: milk, eggs, bread", which is easy to type on a phone keyboard.
 */
export function parseCapture(
  text: string,
  type: ItemType,
): CaptureDraft | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const firstIndex = lines.findIndex(Boolean)
  if (firstIndex === -1) return null

  const first = lines[firstIndex]
  const rest = lines.slice(firstIndex + 1)

  // A pasted paragraph is a normal note: keep all of it in the body under a shortened title.
  if (type === 'note' && first.length > longLine) {
    const body = lines.slice(firstIndex).join('\n').trim()
    return { type, title: shorten(first), body, entries: [] }
  }

  if (type !== 'list') {
    return { type, title: first, body: rest.join('\n').trim(), entries: [] }
  }

  const title = stripBullet(first)
  const entries = rest.map(stripBullet).filter(Boolean)
  const inline = entries.length === 0 ? inlineList.exec(title) : null
  if (inline) {
    return {
      type,
      title: inline[1].trim(),
      body: '',
      entries: inline[2]
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    }
  }
  return { type, title, body: '', entries }
}
