import { PowerSyncDatabase } from '@powersync/web'
import { appSchema } from './schema'
import { createStore } from './store'

// One database per browser profile. During server rendering PowerSync opens a no-op placeholder,
// so routes that read local data render on the client only (`ssr: false`).
export const database = new PowerSyncDatabase({
  schema: appSchema,
  database: { dbFilename: 'oriel.sqlite', disableSSRWarning: true },
})

export const store = createStore(database)
