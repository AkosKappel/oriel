import type { Entry, Item } from './schema'

// Sample data for trying the app and testing edge cases: text that is very short or very long,
// punctuation, Markdown and HTML, emoji, diacritics, other scripts (also right to left), and
// every item state. It is an ordinary JSON export, so Settings → Import loads it with or without
// an account. Written by `npm run samples`; kept free of runtime imports so Node runs it as is.

type Sample = {
  type: Item['type']
  title: string
  body?: string
  entries?: (string | { text: string; done: true })[]
  priority?: Item['priority']
  status?: Item['status']
  /** Days from today. */
  due?: number
  repeat?: Item['repeat']
  /** Snoozed until this many days from today. */
  snoozed?: number
  pinned?: boolean
  done?: boolean
  archived?: boolean
}

const done = (text: string) => ({ text, done: true as const })

const longParagraph =
  'This paragraph repeats to make a long note: it checks scrolling, the preview on home, export and search across a lot of text. '

const samples: Sample[] = [
  // Short and long
  { type: 'note', title: 'a' },
  { type: 'task', title: '?' },
  { type: 'list', title: 'x', entries: ['y'] },
  {
    type: 'note',
    title:
      `A title of exactly two hundred characters ${'that keeps going '.repeat(9)}`
        .slice(0, 199)
        .concat('.'),
    body: 'The title is at the 200 character limit.',
  },
  {
    type: 'note',
    title: 'A very long note',
    body: Array.from({ length: 12 }, (_, n) =>
      `${n + 1}. ${longParagraph.repeat(4)}`.trim(),
    ).join('\n\n'),
  },
  {
    type: 'note',
    title: 'Pneumonoultramicroscopicsilicovolcanoconiosis',
    body: `An unbroken word must wrap instead of widening the page: ${'Donaudampfschifffahrtsgesellschaftskapitän'.repeat(3)}\n\nhttps://example.com/a/very/long/path/that/should/also/wrap/without/scrolling/sideways?query=${'abc'.repeat(30)}`,
  },
  {
    type: 'list',
    title: 'A list with 120 entries',
    entries: Array.from({ length: 120 }, (_, n) =>
      n % 7 === 3 ? done(`Entry ${n + 1}`) : `Entry ${n + 1}`,
    ),
  },
  {
    type: 'list',
    title: 'Entries of every length',
    entries: [
      '1',
      'Two words',
      'A sentence-length entry, with a comma.',
      `The longest entry allowed: ${'five hundred characters '.repeat(21)}`.slice(
        0,
        500,
      ),
    ],
  },
  { type: 'list', title: 'An empty list' },
  { type: 'note', title: 'A note with no text' },

  // Punctuation, Markdown and HTML
  {
    type: 'note',
    title: `Quotes "double" 'single' „Hungarian“ «French» ‹angle›`,
    body: 'Dashes - – —, ellipsis …, bullets • ·, symbols © ® ™ § ¶ † ‰, math ± × ÷ ≠ ≤ ≥ ∞ √, currency 1,000.50 € £5 ¥300 ₿, fractions ½ ¾.',
  },
  {
    type: 'note',
    title: 'Markdown and HTML that must stay harmless',
    body: [
      '# A heading',
      '',
      '**Bold**, *italic*, `code`, ~~struck~~ and a [link](https://example.com).',
      '',
      '- one',
      '- two',
      '  - nested',
      '',
      '1. first',
      '2. second',
      '',
      '> A quotation',
      '',
      '```',
      'const answer = 42',
      '```',
      '',
      '| a | b |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '<script>alert("not run")</script> <img src=x onerror=alert(1)> [bad link](javascript:alert(1))',
    ].join('\n'),
  },
  {
    type: 'list',
    title: 'Entries that look like syntax',
    entries: [
      '- [ ] a checkbox in the text',
      '# not a heading',
      '<b>not bold</b>',
      '+ Groceries',
      '   spaces around   ',
      '100%',
      'a\tb',
    ],
  },
  {
    type: 'note',
    title: '   Spaces around the title   ',
    body: '\n\n\nBlank lines above and below.\n\n\n\nAnd several in between.\n\n\n',
  },

  // Emoji
  {
    type: 'list',
    title: '🛒 Groceries',
    pinned: true,
    entries: ['🥛 Milk', '🍞 Bread', done('🥚 Eggs'), '🍎 Apples', 'Coffee ☕'],
  },
  { type: 'task', title: '🎉', due: 3 },
  {
    type: 'note',
    title: 'Emoji edge cases 👩‍👩‍👧‍👦',
    body: 'Families 👨‍👩‍👧 and professions 🧑‍🍳, skin tones 👍🏻 👍🏽 👍🏿, flags 🇸🇰 🇭🇺 🇯🇵, keycaps 1️⃣ #️⃣, text versus emoji style ☺ ☺️, and newer ones 🫠 🪿.',
  },

  // Diacritics; search should find these without the accents ("arvizturo", "kon", "creme")
  {
    type: 'note',
    title: 'Árvíztűrő tükörfúrógép',
    body: 'Hungarian: ő and ű have double acute accents. ÁRVÍZTŰRŐ TÜKÖRFÚRÓGÉP in capitals.',
  },
  {
    type: 'note',
    title: 'Príliš žltučký kôň úpel ďábelské ódy',
    body: 'Slovak and Czech: ä ô ľ ĺ ŕ ř ů ě ď ť ň.',
  },
  {
    type: 'list',
    title: 'Crème brûlée ingredients',
    entries: ['Crème fraîche', 'Œufs', 'Sucre', 'Vanille de Madagascar'],
  },
  {
    type: 'note',
    title: 'Größe, Straße, façade, niño, smörgåsbord',
    // "café" with a combining accent (e + U+0301) next to the precomposed one.
    body: 'Two ways to write café: café and café. Both should match a search for "cafe".',
  },

  // Other scripts
  {
    type: 'list',
    title: 'Список покупок',
    entries: ['Молоко', 'Хлеб', done('Яйца'), 'Ёлка'],
  },
  { type: 'note', title: 'Λίστα ελέγχου', body: 'Ελληνικά: αβγδε ΑΒΓΔΕ.' },
  {
    type: 'list',
    title: '買い物リスト',
    entries: ['牛乳', 'パン', '卵', 'りんご'],
  },
  { type: 'task', title: '准备会议材料', priority: 2, due: 1 },
  { type: 'note', title: '장보기 목록', body: '한국어 텍스트입니다.' },
  {
    type: 'list',
    title: 'قائمة التسوق',
    entries: ['حليب', 'خبز', done('بيض')],
  },
  {
    type: 'note',
    title: 'רשימת קניות',
    body: 'Right to left with numbers 123 and an English word inside.',
  },
  { type: 'task', title: 'Meeting with أحمد at 10:30 in קומה 3', due: 0 },
  {
    type: 'note',
    title: 'हिन्दी और ภาษาไทย',
    body: 'Devanagari and Thai: complex shaping and no spaces between Thai words สวัสดีครับ.',
  },

  // States: priorities, statuses, due dates, done, archived
  {
    type: 'task',
    title: 'Overdue by a week, high priority',
    priority: 3,
    due: -7,
  },
  { type: 'task', title: 'Due today', due: 0, priority: 1 },
  {
    type: 'task',
    title: 'Due tomorrow, in progress',
    due: 1,
    status: 'in_progress',
  },
  { type: 'task', title: 'Due next year', due: 400 },
  { type: 'task', title: 'Repeats every week', due: 2, repeat: 'weekly' },
  { type: 'note', title: 'Snoozed until next week', snoozed: 7 },
  { type: 'task', title: 'Waiting for someone', status: 'waiting' },
  {
    type: 'task',
    title: 'A task with notes',
    priority: 2,
    body: 'Tasks can have **Markdown** notes too.',
  },
  { type: 'task', title: 'A finished task', done: true },
  {
    type: 'task',
    title: 'A finished task that was overdue',
    done: true,
    due: -3,
  },
  {
    type: 'list',
    title: 'Everything checked',
    entries: [done('One'), done('Two'), done('Three')],
  },
  {
    type: 'note',
    title: 'Pinned and archived',
    archived: true,
    pinned: true,
  },
  { type: 'list', title: 'An archived list', archived: true, entries: ['Old'] },
  { type: 'note', title: 'Same title' },
  {
    type: 'note',
    title: 'Same title',
    body: 'A second item with the same title.',
  },
]

const day = 86_400_000

/** Many plain items for measuring sync, search and scrolling on a large notebook. */
function manySamples(count: number): Sample[] {
  const types = ['note', 'list', 'task'] as const
  return Array.from({ length: count }, (_, n) => {
    const type = types[n % 3]
    return {
      type,
      title: `Bulk ${type} ${n + 1}`,
      body: type === 'note' ? `Filler text number ${n + 1}.` : '',
      entries:
        type === 'list'
          ? Array.from({ length: 5 }, (_, e) => `Entry ${e + 1}`)
          : undefined,
      due: type === 'task' && n % 9 === 2 ? (n % 21) - 7 : undefined,
      done: type === 'task' && n % 4 === 0,
    }
  })
}

/**
 * The samples as an Oriel JSON export. Each item was created a little earlier than the one before
 * it, so home shows them in this order; due dates count from `today`.
 */
export function buildSamples(today: Date, extra = 0) {
  const all = [...samples, ...manySamples(extra)]
  const items = all.map((sample, index) => {
    const created = new Date(today.getTime() - (index + 1) * 60_000)
    const stamp = created.toISOString()
    const id = crypto.randomUUID()
    const entries: Entry[] = (sample.entries ?? []).map((entry, position) => ({
      id: crypto.randomUUID(),
      item_id: id,
      space_id: null,
      text: typeof entry === 'string' ? entry : entry.text,
      completed_at: typeof entry === 'string' ? null : stamp,
      completed_by: null,
      position: created.getTime() + position,
      created_at: stamp,
      updated_at: stamp,
    }))
    return {
      id,
      space_id: null,
      created_by: null,
      type: sample.type,
      title: sample.title,
      body: sample.body ?? '',
      completed_at: sample.done ? stamp : null,
      completed_by: null,
      pinned_at: sample.pinned ? stamp : null,
      priority: sample.priority ?? 0,
      status: sample.status ?? null,
      due_on:
        sample.due === undefined
          ? null
          : new Date(today.getTime() + sample.due * day)
              .toISOString()
              .slice(0, 10),
      repeat: sample.repeat ?? null,
      snoozed_until:
        sample.snoozed === undefined
          ? null
          : new Date(today.getTime() + sample.snoozed * day)
              .toISOString()
              .slice(0, 10),
      archived_at: sample.archived ? stamp : null,
      deleted_at: null,
      deleted_by: null,
      created_at: stamp,
      updated_at: stamp,
      entries,
    } satisfies Item & { entries: Entry[] }
  })
  return { app: 'oriel', version: 1, exported_at: today.toISOString(), items }
}
