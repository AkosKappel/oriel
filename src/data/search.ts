import type { CommonPowerSyncDatabase } from '@powersync/common'
import { fold } from './organize'

// Home and search read entries through SQL, so the entries collection only loads once a list is
// opened. Entry texts are indexed with FTS5's trigram tokenizer: it matches any part of a word,
// like the in-memory search did, and ignores case and accents.

const setUp = new WeakMap<CommonPowerSyncDatabase, Promise<void>>()

/**
 * Creates the search index and the triggers that keep it current, and rebuilds it if it no longer
 * matches the entries. Safe to call more than once.
 */
export function prepareSearch(database: CommonPowerSyncDatabase) {
  let ready = setUp.get(database)
  if (!ready) {
    ready = createIndex(database)
    setUp.set(database, ready)
  }
  return ready
}

async function createIndex(database: CommonPowerSyncDatabase) {
  await database.waitForReady()
  await database.writeTransaction(async (tx) => {
    await tx.execute(
      `CREATE VIRTUAL TABLE IF NOT EXISTS entries_search
       USING fts5(item_id UNINDEXED, text, tokenize = 'trigram remove_diacritics 1')`,
    )
    // PowerSync stores rows as JSON in `ps_data__entries`. Synced rows arrive by REPLACE, which
    // removes the old row without firing delete triggers, so the old copy goes before the insert.
    await tx.execute(
      `CREATE TRIGGER IF NOT EXISTS entries_search_replace
       BEFORE INSERT ON ps_data__entries BEGIN
         DELETE FROM entries_search
         WHERE rowid = (SELECT rowid FROM ps_data__entries WHERE id = NEW.id);
       END`,
    )
    await tx.execute(
      `CREATE TRIGGER IF NOT EXISTS entries_search_insert
       AFTER INSERT ON ps_data__entries BEGIN
         INSERT INTO entries_search (rowid, item_id, text)
         VALUES (NEW.rowid, NEW.data ->> 'item_id', NEW.data ->> 'text');
       END`,
    )
    await tx.execute(
      `CREATE TRIGGER IF NOT EXISTS entries_search_update
       AFTER UPDATE ON ps_data__entries BEGIN
         DELETE FROM entries_search WHERE rowid = OLD.rowid;
         INSERT INTO entries_search (rowid, item_id, text)
         VALUES (NEW.rowid, NEW.data ->> 'item_id', NEW.data ->> 'text');
       END`,
    )
    await tx.execute(
      `CREATE TRIGGER IF NOT EXISTS entries_search_delete
       AFTER DELETE ON ps_data__entries BEGIN
         DELETE FROM entries_search WHERE rowid = OLD.rowid;
       END`,
    )
    // Rows written before the triggers existed, or by a version without them.
    const { indexed, stored } = await tx.get<{
      indexed: number
      stored: number
    }>(
      `SELECT (SELECT count(*) FROM entries_search) AS indexed,
              (SELECT count(*) FROM ps_data__entries) AS stored`,
    )
    if (indexed !== stored) {
      await tx.execute('DELETE FROM entries_search')
      await tx.execute(
        `INSERT INTO entries_search (rowid, item_id, text)
         SELECT rowid, data ->> 'item_id', data ->> 'text' FROM ps_data__entries`,
      )
    }
  })
}

/** The words of a search query, folded the way `searchItems` compares them. */
export const queryWords = (query: string) => [
  ...new Set(fold(query).split(/\s+/).filter(Boolean)),
]

// Trigrams need three characters; shorter words are compared in full instead.
const minimumMatch = 3

/**
 * SQL for the lists whose entries contain each word: rows of `word` and `item_id`. Run it after
 * `prepareSearch`.
 */
export function entrySearchQuery(words: string[]) {
  const parts = words.map((word) =>
    word.length >= minimumMatch
      ? {
          sql: 'SELECT ? AS word, item_id FROM entries_search WHERE text MATCH ?',
          // A quoted string is matched as is; quotes inside it are doubled.
          params: [word, `"${word.replaceAll('"', '""')}"`],
        }
      : {
          sql: `SELECT ? AS word, item_id FROM entries_search WHERE text LIKE ? ESCAPE '\\'`,
          params: [word, `%${word.replace(/[\\%_]/g, '\\$&')}%`],
        },
  )
  return {
    sql: parts.map((part) => part.sql).join(' UNION '),
    params: parts.flatMap((part) => part.params),
  }
}

/** Groups `entrySearchQuery` rows by word, for `searchItems`. */
export function groupMatches(rows: { word: string; item_id: string }[]) {
  const matches = new Map<string, Set<string>>()
  for (const { word, item_id } of rows) {
    const ids = matches.get(word) ?? new Set()
    ids.add(item_id)
    matches.set(word, ids)
  }
  return matches
}

const previewLength = 3

/**
 * SQL for every list's entry count, open count and first few open entries in list order (the
 * order of `sortEntries`), as a JSON array in `up_next`.
 */
export const entrySummaryQuery = `
  SELECT item_id,
         count(*) AS total,
         count(*) FILTER (WHERE completed_at IS NULL) AS open,
         (SELECT json_group_array(text) FROM (
            SELECT text FROM entries AS next
            WHERE next.item_id = entries.item_id AND next.completed_at IS NULL
            ORDER BY position, created_at
            LIMIT ${previewLength}
         )) AS up_next
  FROM entries
  GROUP BY item_id`

export type EntrySummary = { total: number; open: number; upNext: string[] }

/** `entrySummaryQuery` rows by list. */
export function summariesByItem(
  rows: { item_id: string; total: number; open: number; up_next: string }[],
) {
  return new Map<string, EntrySummary>(
    rows.map((row) => [
      row.item_id,
      {
        total: row.total,
        open: row.open,
        upNext: JSON.parse(row.up_next) as string[],
      },
    ]),
  )
}
