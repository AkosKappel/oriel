import {
  type Collection,
  type NonSingleResult,
  useLiveQuery,
} from '@tanstack/react-db'

/**
 * Every row of a collection, live. Subscribes to the collection itself instead of compiling a
 * query over all of it, which builds a second collection per hook and cost a large part of the
 * home page's start-up time.
 */
export function useRows<T extends object>(
  // biome-ignore lint/suspicious/noExplicitAny: any utils and schema; only the rows matter here
  collection: Collection<T, string, any, any, any>,
) {
  // PowerSync's schema-typed collections do not match the hook's generic overload, although
  // the runtime accepts any collection.
  return useLiveQuery(
    collection as unknown as Collection<T, string> & NonSingleResult,
  )
}
