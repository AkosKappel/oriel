import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PowerSyncDatabase } from '@powersync/node'
import { appSchema } from '#/data/schema'
import { createStore } from '#/data/store'

// Stands in for `#/data/client` in component tests: the same store on real SQLite in Node.
export const database = new PowerSyncDatabase({
  schema: appSchema,
  database: {
    dbFilename: 'test.sqlite',
    dbLocation: mkdtempSync(join(tmpdir(), 'oriel-ui-')),
  },
})
await database.init()

export const store = createStore(database)
