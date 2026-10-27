import type {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  PowerSyncCredentials,
} from '@powersync/web'

type UploadResult = { rejected: unknown[] }

const batchSize = 200

/**
 * Connects PowerSync to Oriel's server: credentials come from `/api/sync/token`, local changes go
 * to `/api/sync/upload`. Throwing keeps a batch in the queue for PowerSync to retry; completing
 * it removes it.
 */
export class SyncConnector implements PowerSyncBackendConnector {
  constructor(
    private readonly events: {
      /** The server refused some changes; the next sync replaces them with its own rows. */
      onRejected: (count: number) => void
      /** The session is gone: sync stops until the user signs in again. */
      onSignedOut: () => void
    },
  ) {}

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const response = await fetch('/api/sync/token', {
      credentials: 'same-origin',
    })
    if (response.status === 401) {
      this.events.onSignedOut()
      return null
    }
    // Sync is not set up on this server; the app keeps working on the device.
    if (response.status === 503) return null
    if (!response.ok) {
      throw new Error(`Could not get sync credentials (${response.status})`)
    }
    return response.json()
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    const batch = await database.getCrudBatch(batchSize)
    if (!batch) return

    const response = await fetch('/api/sync/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operations: batch.crud.map(({ op, table, id, opData }) => ({
          op,
          table,
          id,
          data: opData ?? null,
        })),
      }),
    })

    if (response.status === 400) {
      // A malformed batch never succeeds; retrying would block every later change.
      console.error('The server refused a malformed upload batch')
      this.events.onRejected(batch.crud.length)
      await batch.complete()
      return
    }
    if (!response.ok) {
      throw new Error(`Upload failed (${response.status}); it will be retried`)
    }

    const { rejected } = (await response.json()) as UploadResult
    if (rejected.length > 0) this.events.onRejected(rejected.length)
    await batch.complete()
  }
}
