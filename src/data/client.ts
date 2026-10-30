import { PowerSyncDatabase } from '@powersync/web'
import { toast } from 'sonner'
import {
  currentAccount,
  markNeedsSignIn,
  subscribeAccount,
} from '#/lib/account'
import { SyncConnector } from './connector'
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

const connector = new SyncConnector({
  onRejected: (count) =>
    toast(
      `${count} ${count === 1 ? 'change was' : 'changes were'} not accepted by the server and ${count === 1 ? 'was' : 'were'} undone.`,
    ),
  // Keep the data and the owner: signing in again as the same person continues where it was.
  onSignedOut: markNeedsSignIn,
})

/** Connects the database to the sync service for the remembered account. */
export function startSync() {
  database.connect(connector).catch((error: unknown) => {
    console.error('Could not start sync', error)
  })
}

// New items belong to whoever is signed in on this device, also offline.
function followAccount() {
  const account = currentAccount()
  store.setOwner(
    account && { userId: account.userId, spaceId: account.spaceId },
  )
}
followAccount()
subscribeAccount(followAccount)

// A reload in the few milliseconds before a write is stored would drop it.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (store.hasPendingWrites()) event.preventDefault()
  })
}

// Pages that open the database also sync it; pages that do not (sign-in, settings) never load
// PowerSync at all.
if (typeof window !== 'undefined' && currentAccount()) startSync()
