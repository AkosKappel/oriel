import type { Locale } from '#/paraglide/runtime.js'
import { fold } from './organize'
import type { Item, ItemType } from './schema'

export type CaptureDraft = {
  type: ItemType
  title: string
  body: string
  entries: string[]
}

// A bullet or number, then a Markdown checkbox, each optional: "- [x] milk", "2) rice", "[ ] jam".
// Numbers need a space after them, so "2.5 kg flour" keeps its quantity.
const bullet = /^(?:[-*•]\s*|\d+[.)]\s+)?(?:\[([ xX]?)\]\s*)?/

/** Removes a leading bullet, number or checkbox from a pasted or typed list line. */
export const stripBullet = (line: string) => line.replace(bullet, '')

/** A list line as an entry, checked when it was written as "[x]". */
export function readEntryLine(line: string) {
  const checked = /^[xX]$/.test(bullet.exec(line)?.[1] ?? '')
  return { text: stripBullet(line).trim(), checked }
}

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

export type AppendDraft =
  | { list: Item; entries: string[] }
  | { list: null; name: string }

/**
 * Reads "+Groceries eggs, milk" (or "+Groceries" with entries on the next lines) as entries for a
 * list that already exists. The list is the one whose title the text starts with, ignoring case and
 * accents; the longest title wins, so "+Weekly shop" beats "+Weekly". Returns null for text that
 * does not start with "+".
 */
export function parseAppend(text: string, lists: Item[]): AppendDraft | null {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('+')) return null
  const [first, ...rest] = trimmed.slice(1).split(/\r?\n/)
  const firstLine = first.trim()

  const list = [...lists]
    .sort((a, b) => b.title.length - a.title.length)
    .find((candidate) => {
      const head = firstLine.slice(0, candidate.title.length)
      const next = firstLine.charAt(candidate.title.length)
      return fold(head) === fold(candidate.title) && /^[\s:,]?$/.test(next)
    })
  if (!list) return { list: null, name: firstLine }

  const inline = firstLine
    .slice(list.title.length)
    .replace(/^\s*:?\s*/, '')
    .split(',')
  const entries = [...inline, ...rest]
    .map((line) => stripBullet(line.trim()).trim())
    .filter(Boolean)
  return { list, entries }
}

// Due days typed at the end of a task, read from the folded words (lowercase, no accents). Every
// language has its own rules, and English words work in all of them; numeric dates follow each
// language's own order, so they never come from English: day first in Ireland and Slovakia, month
// first in Hungary.

type Day = { year: number; month: number; day: number }
type Rule = {
  pattern: RegExp
  read: (match: string[], today: Day) => Day | null
}

// Noon UTC, so no time zone or daylight saving change moves the day.
const utc = ({ year, month, day }: Day) =>
  new Date(Date.UTC(year, month - 1, day, 12))
const fromDate = (date: Date): Day => ({
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
})
const addDays = (today: Day, days: number) =>
  fromDate(new Date(utc(today).getTime() + days * 86_400_000))
/** Months on, keeping the day or taking the month's last day when it is shorter. */
function addMonths(today: Day, months: number): Day {
  const first = new Date(Date.UTC(today.year, today.month - 1 + months, 1, 12))
  const last = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  ).getUTCDate()
  return { ...fromDate(first), day: Math.min(today.day, last) }
}
/** The next given weekday (0 Sunday) after today, or the one in next week (from Monday). */
function weekday(today: Day, target: number, nextWeek = false) {
  const current = utc(today).getUTCDay()
  if (!nextWeek) return addDays(today, (target - current + 7) % 7 || 7)
  const toMonday = (8 - current) % 7 || 7
  return addDays(today, toMonday + ((target + 6) % 7))
}
/** Saturday, or today when it is already the weekend's Saturday. */
const weekend = (today: Day) =>
  utc(today).getUTCDay() === 6 ? today : weekday(today, 6)
/** A calendar day, null if it does not exist; without a year, the next time it comes. */
function date(
  day: number,
  month: number,
  year: number | undefined,
  today: Day,
) {
  const candidate = { year: year ?? today.year, month, day }
  const check = utc(candidate)
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)
    return null
  if (year === undefined && utc(candidate) < utc(today)) {
    return date(day, month, today.year + 1, today)
  }
  return candidate
}
function amount(text: string | undefined, words: Record<string, number>) {
  if (text === undefined) return 1
  return /^\d+$/.test(text) ? Number(text) : (words[text] ?? null)
}
const step = (
  today: Day,
  count: number | null,
  unit: 'day' | 'week' | 'month',
) =>
  count === null || count < 1
    ? null
    : unit === 'month'
      ? addMonths(today, count)
      : addDays(today, unit === 'week' ? count * 7 : count)

/** An alternation of names, longest first, mapped to their index in `groups`. */
function names(groups: string[][]) {
  const index = new Map(
    groups.flatMap((forms, at) => forms.map((form) => [form, at] as const)),
  )
  const source = [...index.keys()].sort((a, b) => b.length - a.length).join('|')
  return { source, of: (name: string) => index.get(name) ?? -1 }
}
const rule = (source: string, read: Rule['read']): Rule => ({
  pattern: new RegExp(`(?:^| )(?:${source})[.,!?]*$`),
  read,
})
const fixed = (source: string, days: number) =>
  rule(source, (_, today) => addDays(today, days))
const num = (text: string | undefined) => (text ? Number(text) : undefined)

const enWeekdays = names([
  ['sunday', 'sun'],
  ['monday', 'mon'],
  ['tuesday', 'tue', 'tues'],
  ['wednesday', 'wed'],
  ['thursday', 'thu', 'thurs'],
  ['friday', 'fri'],
  ['saturday', 'sat'],
])
const enMonths = names([
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sept', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
])
const enUnits = {
  day: 'day',
  days: 'day',
  week: 'week',
  weeks: 'week',
  month: 'month',
  months: 'month',
} as const
const enWords: Rule[] = [
  fixed('today|tonight', 0),
  fixed('tomorrow|tmrw|tmr', 1),
  fixed('(?:the )?day after tomorrow', 2),
  rule(`(?:on |this )?(${enWeekdays.source})`, ([, name], today) =>
    weekday(today, enWeekdays.of(name)),
  ),
  rule(`next (${enWeekdays.source})`, ([, name], today) =>
    weekday(today, enWeekdays.of(name), true),
  ),
  rule('next week', (_, today) => weekday(today, 1)),
  rule('next month', (_, today) => addMonths(today, 1)),
  rule(
    `in (\\d{1,2}|a|an|one|two|three) (days?|weeks?|months?)`,
    ([, count, unit], today) =>
      step(
        today,
        amount(count, { a: 1, an: 1, one: 1, two: 2, three: 3 }),
        enUnits[unit as keyof typeof enUnits],
      ),
  ),
  rule('(?:this |on the |at the )?weekend', (_, today) => weekend(today)),
  rule(
    `(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?(?: of)? (${enMonths.source})\\.?(?:,? (\\d{4}))?`,
    ([, day, month, year], today) =>
      date(Number(day), enMonths.of(month) + 1, num(year), today),
  ),
  rule(
    `(?:on )?(${enMonths.source})\\.? (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?`,
    ([, month, day, year], today) =>
      date(Number(day), enMonths.of(month) + 1, num(year), today),
  ),
]
const isoDate = rule(
  '(\\d{4})-(\\d{2})-(\\d{2})',
  ([, year, month, day], today) =>
    date(Number(day), Number(month), Number(year), today),
)
// "12/11", "12/11/2027", "12.11." and "12.11.2027"; a dot date needs its final dot, so "1.2" stays.
const dayFirst = rule(
  '(?:on )?(\\d{1,2})(?:/(\\d{1,2})(?:/(\\d{4}))?|\\. ?(\\d{1,2})\\.(?: ?(\\d{4})\\.?)?)',
  ([, day, slashMonth, slashYear, dotMonth, dotYear], today) =>
    date(
      Number(day),
      Number(slashMonth ?? dotMonth),
      num(slashYear ?? dotYear),
      today,
    ),
)

const huWeekdays = names([
  ['vasarnap'],
  ['hetfo', 'hetfon'],
  ['kedd', 'kedden'],
  ['szerda', 'szerdan'],
  ['csutortok', 'csutortokon'],
  ['pentek', 'penteken'],
  ['szombat', 'szombaton'],
])
const huMonths = names([
  ['januar', 'jan'],
  ['februar', 'febr', 'feb'],
  ['marcius', 'marc'],
  ['aprilis', 'apr'],
  ['majus', 'maj'],
  ['junius', 'jun'],
  ['julius', 'jul'],
  ['augusztus', 'aug'],
  ['szeptember', 'szept'],
  ['oktober', 'okt'],
  ['november', 'nov'],
  ['december', 'dec'],
])
const huUnits = { nap: 'day', het: 'week', honap: 'month' } as const
const huRules: Rule[] = [
  fixed('ma', 0),
  fixed('holnap', 1),
  fixed('holnaputan', 2),
  rule(`(jovo )?(${huWeekdays.source})`, ([, next, name], today) =>
    weekday(today, huWeekdays.of(name), Boolean(next)),
  ),
  rule('jovo heten|jovo het', (_, today) => weekday(today, 1)),
  rule('jovo honapban', (_, today) => addMonths(today, 1)),
  rule(
    '(\\d{1,2}|egy|ket|harom) (nap|het|honap) mulva',
    ([, count, unit], today) =>
      step(
        today,
        amount(count, { egy: 1, ket: 2, harom: 3 }),
        huUnits[unit as keyof typeof huUnits],
      ),
  ),
  rule('(?:a )?hetvegen', (_, today) => weekend(today)),
  // "2026.12.24.", then "11.12." or "11. 12.": the month comes first.
  rule(
    '(\\d{4})\\. ?(\\d{1,2})\\. ?(\\d{1,2})\\.?',
    ([, year, month, day], today) =>
      date(Number(day), Number(month), Number(year), today),
  ),
  rule('(\\d{1,2})\\. ?(\\d{1,2})\\.', ([, month, day], today) =>
    date(Number(day), Number(month), undefined, today),
  ),
  rule(
    `(${huMonths.source})\\.? (\\d{1,2})(?:\\.|-[a-z]+)?`,
    ([, month, day], today) =>
      date(Number(day), huMonths.of(month) + 1, undefined, today),
  ),
]

const skWeekdays = names([
  ['nedela', 'nedelu'],
  ['pondelok'],
  ['utorok'],
  ['streda', 'stredu'],
  ['stvrtok'],
  ['piatok'],
  ['sobota', 'sobotu'],
])
const skMonths = names([
  ['januar', 'januara'],
  ['februar', 'februara'],
  ['marec', 'marca'],
  ['april', 'aprila'],
  ['maj', 'maja'],
  ['jun', 'juna'],
  ['jul', 'jula'],
  ['august', 'augusta'],
  ['september', 'septembra'],
  ['oktober', 'oktobra'],
  ['november', 'novembra'],
  ['december', 'decembra'],
])
const skUnits: Record<string, 'day' | 'week' | 'month'> = {
  den: 'day',
  dni: 'day',
  tyzden: 'week',
  tyzdne: 'week',
  tyzdnov: 'week',
  mesiac: 'month',
  mesiace: 'month',
  mesiacov: 'month',
}
const skRules: Rule[] = [
  fixed('dnes', 0),
  fixed('zajtra', 1),
  fixed('pozajtra', 2),
  rule(`(?:v |vo |na )?(${skWeekdays.source})`, ([, name], today) =>
    weekday(today, skWeekdays.of(name)),
  ),
  rule(`(?:buduci|buducu) (${skWeekdays.source})`, ([, name], today) =>
    weekday(today, skWeekdays.of(name), true),
  ),
  rule('(?:na )?buduci tyzden|v buducom tyzdni', (_, today) =>
    weekday(today, 1),
  ),
  rule('(?:na )?buduci mesiac|v buducom mesiaci', (_, today) =>
    addMonths(today, 1),
  ),
  rule(
    `o (?:(\\d{1,2}|dva|dve|tri) )?(${Object.keys(skUnits).join('|')})`,
    ([, count, unit], today) =>
      step(today, amount(count, { dva: 2, dve: 2, tri: 3 }), skUnits[unit]),
  ),
  rule('(?:cez |na )?vikend', (_, today) => weekend(today)),
  rule(
    `(\\d{1,2})\\. (${skMonths.source})(?: (\\d{4}))?`,
    ([, day, month, year], today) =>
      date(Number(day), skMonths.of(month) + 1, num(year), today),
  ),
]

const rules: Record<Locale, Rule[]> = {
  en: [...enWords, isoDate, dayFirst],
  hu: [...huRules, ...enWords, isoDate],
  sk: [...skRules, ...enWords, isoDate, dayFirst],
}

/**
 * Reads a due day from the end of a task's title ("Call the dentist tomorrow", "Pay rent 12.11.",
 * "Nájom budúci piatok") and returns the title without it. `today` is the device's day
 * (`YYYY-MM-DD`). The longest phrase wins; returns null when no phrase ends the title, or when
 * nothing would be left of it.
 */
export function readDueDay(
  title: string,
  today: string,
  locale: Locale,
): { title: string; due: string } | null {
  const words = title.trim().split(/\s+/)
  // Six words cover the longest phrase ("on the 12th of November, 2027").
  const tail = words.slice(-6).map(fold).join(' ')
  const [year, month, day] = today.split('-').map(Number)
  let best: { used: number; due: Day } | null = null
  for (const { pattern, read } of rules[locale]) {
    const match = pattern.exec(tail)
    if (!match) continue
    const used = match[0].trim().split(' ').length
    if (best && used <= best.used) continue
    const due = read(match, { year, month, day })
    if (due) best = { used, due }
  }
  if (!best || best.used >= words.length) return null
  const pad = (value: number) => String(value).padStart(2, '0')
  return {
    title: words
      .slice(0, -best.used)
      .join(' ')
      .replace(/[\s,;:–-]+$/, ''),
    due: `${best.due.year}-${pad(best.due.month)}-${pad(best.due.day)}`,
  }
}
