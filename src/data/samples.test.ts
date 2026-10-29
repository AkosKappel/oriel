import { describe, expect, it } from 'vitest'
import { database, store } from '#/test/client'
import { parseExport } from './export'
import { searchItems } from './organize'
import { buildSamples } from './samples'

describe('sample data', () => {
  it('imports completely through the normal import, on a device without an account', async () => {
    const file = buildSamples(new Date('2026-10-29T12:00:00Z'), 30)
    const { items, invalid } = parseExport(JSON.stringify(file))
    expect(invalid).toBe(0)

    const { added, skipped } = await store.importItems(items)
    // The importer trims and validates like the app does; nothing may be refused.
    expect({ added, skipped }).toEqual({ added: items.length, skipped: 0 })
    const entryCount = items.reduce((sum, item) => sum + item.entries.length, 0)
    const stored = await database.get<{ n: number }>(
      'SELECT count(*) AS n FROM entries',
    )
    expect(stored.n).toBe(entryCount)

    const rows = store.items.toArray
    const titles = (query: string) =>
      searchItems(rows, store.entries.toArray, query).map((item) => item.title)
    expect(titles('arvizturo')).toEqual(['Árvíztűrő tükörfúrógép'])
    expect(titles('cafe')).toContain('Größe, Straße, façade, niño, smörgåsbord')
    expect(titles('Молоко')).toEqual(['Список покупок'])
  })

  it('puts due dates relative to the given day', () => {
    const { items } = buildSamples(new Date('2026-10-29T12:00:00Z'))
    const due = (title: string) =>
      items.find((item) => item.title === title)?.due_on
    expect(due('Due today')).toBe('2026-10-29')
    expect(due('Overdue by a week, high priority')).toBe('2026-10-22')
  })
})
