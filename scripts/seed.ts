// Demo and test data for development: `npm run db:seed` (add `-- --big` for 2,000 more items).
// Deletes and recreates the demo users, their spaces and everything in them. Never run it against
// production. Sign in with any of the emails below and `demo-password`.
//
// - Anna: personal space with every kind of item and state (pinned, priorities, statuses, due
//   dates around today, done, archived, trashed, long lists, Markdown, accents for search).
//   Owner of the shared "Home" space.
// - Ben: editor in Home, checks off groceries and finishes chores; a small personal space.
// - Cleo: viewer in Home, empty personal space for empty states and read-only screens.
// - Home: shared list, notes and tasks by both editors, a pending and an expired invite.
import { createHash, randomBytes } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  account,
  entries,
  invite,
  items,
  space,
  spaceMember,
  user,
} from '../src/server/db/schema.ts'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client, { casing: 'snake_case' })

const password = 'demo-password'
const demo = {
  anna: { email: 'anna@example.com', name: 'Anna' },
  ben: { email: 'ben@example.com', name: 'Ben' },
  cleo: { email: 'cleo@example.com', name: 'Cleo' },
}

const day = 86_400_000
const now = Date.now()
const ago = (days: number) => new Date(now - days * day)
/** A calendar day relative to today, as `YYYY-MM-DD`. */
const dueIn = (days: number) =>
  new Date(now + days * day).toISOString().slice(0, 10)

async function createUser({ email, name }: { email: string; name: string }) {
  const id = crypto.randomUUID()
  await db.insert(user).values({ id, name, email, emailVerified: true })
  await db.insert(account).values({
    id: crypto.randomUUID(),
    userId: id,
    accountId: id,
    providerId: 'credential',
    password: await hashPassword(password),
  })
  const [personal] = await db
    .insert(space)
    .values({ name: 'Personal', personalOwnerId: id })
    .returning({ id: space.id })
  await db.insert(spaceMember).values({
    spaceId: personal.id,
    userId: id,
    role: 'owner',
    memberName: name,
  })
  return { id, name, spaceId: personal.id }
}

type Person = Awaited<ReturnType<typeof createUser>>
type Entry = string | { text: string; doneBy: Person; doneDaysAgo?: number }

type ItemSeed = {
  type: 'note' | 'list' | 'task'
  title: string
  body?: string
  entries?: Entry[]
  priority?: number
  status?: 'in_progress' | 'waiting'
  dueOn?: string
  pinned?: boolean
  doneBy?: Person
  archived?: boolean
  trashedBy?: Person
  /** How long ago it was created; older items sort lower on home. */
  daysOld?: number
}

/** Builds item and entry rows for one space; `insert` writes them in chunks. */
class SpaceContent {
  items: (typeof items.$inferInsert)[] = []
  entries: (typeof entries.$inferInsert)[] = []

  spaceId: string

  constructor(spaceId: string) {
    this.spaceId = spaceId
  }

  add(by: Person, seed: ItemSeed) {
    const id = crypto.randomUUID()
    const created = ago(seed.daysOld ?? 0)
    this.items.push({
      id,
      spaceId: this.spaceId,
      createdBy: by.id,
      type: seed.type,
      title: seed.title,
      body: seed.body ?? '',
      priority: seed.priority ?? 0,
      status: seed.status ?? null,
      dueOn: seed.dueOn ?? null,
      pinnedAt: seed.pinned ? created : null,
      completedAt: seed.doneBy ? ago(1) : null,
      completedBy: seed.doneBy?.id ?? null,
      archivedAt: seed.archived ? ago(3) : null,
      deletedAt: seed.trashedBy ? ago(2) : null,
      deletedBy: seed.trashedBy?.id ?? null,
      createdAt: created,
      updatedAt: created,
    })
    seed.entries?.forEach((entry, index) => {
      const done = typeof entry === 'string' ? null : entry
      this.entries.push({
        id: crypto.randomUUID(),
        itemId: id,
        spaceId: this.spaceId,
        text: typeof entry === 'string' ? entry : entry.text,
        completedAt: done ? ago(done.doneDaysAgo ?? 0) : null,
        completedBy: done?.doneBy.id ?? null,
        // Milliseconds when added, like the client, so the order holds.
        position: created.getTime() + index,
        createdAt: created,
        updatedAt: created,
      })
    })
  }

  async insert() {
    for (let i = 0; i < this.items.length; i += 500) {
      await db.insert(items).values(this.items.slice(i, i + 500))
    }
    for (let i = 0; i < this.entries.length; i += 1000) {
      await db.insert(entries).values(this.entries.slice(i, i + 1000))
    }
  }
}

function seedAnna(anna: Person) {
  const content = new SpaceContent(anna.spaceId)
  const done = (text: string) => ({ text, doneBy: anna })

  content.add(anna, {
    type: 'note',
    title: 'Welcome to Oriel',
    pinned: true,
    daysOld: 30,
    body: [
      '# A calm place for notes, lists and tasks',
      '',
      'Everything works **offline** and syncs when you are back online.',
      '',
      '- Type in the capture bar and press Enter',
      '- Start a line with `+ Groceries` to add to that list',
      '- Swipe a row to finish, archive or trash it',
      '',
      'Read more on [the project page](https://github.com/AkosKappel/oriel).',
    ].join('\n'),
  })
  content.add(anna, {
    type: 'task',
    title: 'Renew passport',
    priority: 3,
    dueOn: dueIn(-3),
    daysOld: 12,
  })
  content.add(anna, {
    type: 'task',
    title: 'Call the dentist',
    priority: 2,
    dueOn: dueIn(0),
    daysOld: 4,
  })
  content.add(anna, {
    type: 'task',
    title: 'Pay the electricity bill',
    priority: 1,
    dueOn: dueIn(1),
    daysOld: 6,
  })
  content.add(anna, {
    type: 'task',
    title: 'Plan the birthday dinner',
    status: 'in_progress',
    dueOn: dueIn(5),
    daysOld: 8,
    body: 'Book a table for six. Ask about a cake.',
  })
  content.add(anna, {
    type: 'task',
    title: 'Hear back from the landlord about the heating',
    status: 'waiting',
    daysOld: 9,
  })
  content.add(anna, { type: 'task', title: 'Back up the photos', daysOld: 15 })
  content.add(anna, {
    type: 'task',
    title: 'Return the library books',
    doneBy: anna,
    daysOld: 10,
  })
  content.add(anna, {
    type: 'task',
    title: 'Send the tax form',
    priority: 3,
    doneBy: anna,
    daysOld: 20,
  })
  content.add(anna, {
    type: 'list',
    title: 'Packing for Vienna',
    daysOld: 2,
    entries: [
      done('Passport'),
      done('Charger'),
      'Rain jacket',
      'Walking shoes',
      done('Train tickets'),
      'Gift for Eva',
      'Book for the train',
    ],
  })
  content.add(anna, {
    type: 'list',
    title: 'Books to read',
    daysOld: 40,
    entries: [
      'The Remains of the Day',
      'Piranesi',
      'A Gentleman in Moscow',
      'The Overstory',
      'Klara and the Sun',
      'Stoner',
      'The Left Hand of Darkness',
      'Middlemarch',
      'The Name of the Rose',
      'Kafka on the Shore',
      'Station Eleven',
      'The Dispossessed',
      'Never Let Me Go',
      'Pachinko',
      'The Master and Margarita',
      'Anna Karenina',
      'Things Fall Apart',
      'The Shadow of the Wind',
      'Rebecca',
      'The Secret History',
      'Cloud Atlas',
      'Hamnet',
      'East of Eden',
      'The Leopard',
      done('Circe'),
      done('Project Hail Mary'),
    ],
  })
  content.add(anna, {
    type: 'note',
    title: 'Kávé és croissant',
    daysOld: 5,
    body: 'The café on Fő utca opens at 7. Try the pogácsa; search finds this note with "kave" too.',
  })
  content.add(anna, {
    type: 'note',
    title:
      'Ideas for the garden next spring, including the raised beds, the herb spiral and the small pond by the fence',
    daysOld: 25,
    body: [
      'Raised beds along the south wall: tomatoes, courgettes, beans.',
      '',
      'Herb spiral near the kitchen door. Rosemary at the top, mint at the bottom in a pot so it does not spread.',
      '',
      'A small pond by the fence for frogs. Check how deep it has to be to stay unfrozen.',
    ].join('\n'),
  })
  content.add(anna, {
    type: 'list',
    title: 'Moving out of the old flat',
    archived: true,
    daysOld: 90,
    entries: [
      done('Meter readings'),
      done('Return keys'),
      done('Forward mail'),
    ],
  })
  content.add(anna, {
    type: 'note',
    title: 'Draft I no longer need',
    trashedBy: anna,
    daysOld: 14,
    body: 'In the trash; devices delete it for good after 30 days.',
  })
  return content
}

function seedHome(anna: Person, ben: Person, homeId: string) {
  const content = new SpaceContent(homeId)
  content.add(anna, {
    type: 'list',
    title: 'Groceries',
    pinned: true,
    daysOld: 1,
    entries: [
      'Milk',
      'Bread',
      { text: 'Eggs', doneBy: ben },
      'Apples',
      { text: 'Coffee beans', doneBy: ben },
      'Washing-up liquid',
      { text: 'Tomatoes', doneBy: anna },
    ],
  })
  content.add(ben, {
    type: 'task',
    title: 'Take out the recycling',
    dueOn: dueIn(0),
    daysOld: 3,
  })
  content.add(anna, {
    type: 'task',
    title: 'Fix the dripping tap',
    doneBy: ben,
    daysOld: 7,
  })
  content.add(ben, {
    type: 'task',
    title: 'Book the chimney sweep',
    priority: 2,
    dueOn: dueIn(10),
    daysOld: 2,
  })
  content.add(anna, {
    type: 'note',
    title: 'House notes',
    daysOld: 60,
    body: 'Bins go out on Tuesday evening. The fuse box is behind the coat rack.',
  })
  content.add(ben, {
    type: 'list',
    title: 'Weekend chores',
    daysOld: 4,
    entries: [
      { text: 'Vacuum', doneBy: ben },
      'Water the plants',
      'Change the bed sheets',
    ],
  })
  return content
}

function seedBen(ben: Person) {
  const content = new SpaceContent(ben.spaceId)
  content.add(ben, {
    type: 'note',
    title: 'Bike service',
    body: 'Brakes squeak. Chain needs oil.',
    daysOld: 3,
  })
  content.add(ben, {
    type: 'task',
    title: 'Renew the gym membership',
    dueOn: dueIn(2),
  })
  return content
}

/** Many items for measuring sync and search on large notebooks (backlog S-08). */
function seedMany(anna: Person, count: number) {
  const content = new SpaceContent(anna.spaceId)
  const types = ['note', 'list', 'task'] as const
  for (let i = 0; i < count; i++) {
    const type = types[i % 3]
    content.add(anna, {
      type,
      title: `${type[0].toUpperCase()}${type.slice(1)} ${i + 1}`,
      body: type === 'note' ? `Sample text number ${i + 1}.` : '',
      entries:
        type === 'list'
          ? Array.from({ length: 5 }, (_, n) => `Entry ${n + 1}`)
          : undefined,
      dueOn: type === 'task' && i % 9 === 2 ? dueIn((i % 21) - 7) : undefined,
      doneBy: type === 'task' && i % 4 === 0 ? anna : undefined,
      daysOld: 100 + (i % 300),
    })
  }
  return content
}

async function createInvite(
  spaceId: string,
  createdBy: string,
  email: string,
  expiresInDays: number,
) {
  await db.insert(invite).values({
    spaceId,
    createdBy,
    email,
    role: 'editor',
    tokenHash: createHash('sha256')
      .update(randomBytes(32).toString('base64url'))
      .digest('hex'),
    expiresAt: new Date(now + expiresInDays * day),
  })
}

const emails = Object.values(demo).map((person) => person.email)
// Shared spaces have no owner column and outlive their members, so remove the demo ones first.
const demoSpaces = await client`
  select distinct m.space_id from space_member m join "user" u on u.id = m.user_id
  where u.email in ${client(emails)}`
if (demoSpaces.length > 0) {
  await db.delete(space).where(
    inArray(
      space.id,
      demoSpaces.map((row) => row.space_id as string),
    ),
  )
}
await db.delete(user).where(inArray(user.email, emails))

const anna = await createUser(demo.anna)
const ben = await createUser(demo.ben)
const cleo = await createUser(demo.cleo)

const [home] = await db
  .insert(space)
  .values({ name: 'Home' })
  .returning({ id: space.id })
await db.insert(spaceMember).values([
  { spaceId: home.id, userId: anna.id, role: 'owner', memberName: anna.name },
  { spaceId: home.id, userId: ben.id, role: 'editor', memberName: ben.name },
  { spaceId: home.id, userId: cleo.id, role: 'viewer', memberName: cleo.name },
])
await createInvite(home.id, anna.id, 'grandma@example.com', 5)
await createInvite(home.id, anna.id, 'old-friend@example.com', -3)

const contents = [seedAnna(anna), seedHome(anna, ben, home.id), seedBen(ben)]
if (process.argv.includes('--big')) contents.push(seedMany(anna, 2000))
for (const content of contents) await content.insert()

const itemCount = contents.reduce((sum, c) => sum + c.items.length, 0)
console.log(
  `Seeded ${emails.join(', ')} (password ${password}) with ${itemCount} items`,
)
await client.end()
