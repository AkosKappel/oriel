import { PowerSyncDatabase } from '@powersync/web'
import { appSchema } from './schema'
import { createStore, type Store } from './store'

// One database per browser profile. During server rendering PowerSync opens a no-op placeholder,
// so routes that read local data render on the client only (`ssr: false`).
export const database: PowerSyncDatabase =
  import.meta.hot?.data.database ??
  new PowerSyncDatabase({
    schema: appSchema,
    database: { dbFilename: 'oriel.sqlite', disableSSRWarning: true },
  })

export const store: Store = import.meta.hot?.data.store ?? createStore(database)

// Editing the data layer during development must not re-create the collections under the same
// ids while hooks still use them, which TanStack DB refuses: the new module keeps the old
// database and store, and a reload then picks up the changed code.
if (import.meta.hot) {
  import.meta.hot.data.database = database
  import.meta.hot.data.store = store
  import.meta.hot.accept(() => window.location.reload())
}
