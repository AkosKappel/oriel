import type { CommonPowerSyncDatabase } from '@powersync/common'
import { useEffect, useMemo, useState } from 'react'
import {
  entrySearchQuery,
  entrySummaryQuery,
  groupMatches,
  prepareSearch,
  queryWords,
  summariesByItem,
} from '#/data/search'

/** Rows of a query over entries, re-run whenever entries change. */
function useEntryQuery<Row>(
  database: CommonPowerSyncDatabase,
  sql: string | null,
  params: unknown[],
) {
  const [state, setState] = useState<{ rows: Row[]; isLoading: boolean }>({
    rows: [],
    isLoading: true,
  })
  const key = JSON.stringify(params)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands in for `params`
  useEffect(() => {
    if (!sql) {
      setState({ rows: [], isLoading: false })
      return
    }
    const controller = new AbortController()
    prepareSearch(database).then(() => {
      if (controller.signal.aborted) return
      database.watch(
        sql,
        params,
        {
          onResult: (result) =>
            setState({ rows: result.rows?._array ?? [], isLoading: false }),
          onError: (error) => console.error('Entry query failed', error),
        },
        // The search index is a virtual table, whose changes PowerSync does not see.
        { signal: controller.signal, tables: ['entries'] },
      )
    }, console.error)
    return () => controller.abort()
  }, [database, sql, key])

  return state
}

/** Per folded query word, the lists whose entries contain it. */
export function useEntryMatches(
  database: CommonPowerSyncDatabase,
  query: string,
) {
  const words = queryWords(query)
  const { sql, params } = words.length
    ? entrySearchQuery(words)
    : { sql: null, params: [] }
  const { rows } = useEntryQuery<{ word: string; item_id: string }>(
    database,
    sql,
    params,
  )
  return useMemo(() => groupMatches(rows), [rows])
}

/** Entry counts and the first open entries per list, or null until they are read. */
export function useEntrySummaries(database: CommonPowerSyncDatabase) {
  const { rows, isLoading } = useEntryQuery<
    Parameters<typeof summariesByItem>[0][number]
  >(database, entrySummaryQuery, [])
  return useMemo(
    () => (isLoading ? null : summariesByItem(rows)),
    [rows, isLoading],
  )
}
