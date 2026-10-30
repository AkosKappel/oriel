import type { SyncStatus } from '@powersync/web'
import { useSyncExternalStore } from 'react'
import { database } from '#/data/client'
import { m } from '#/paraglide/messages.js'

function subscribe(onChange: () => void) {
  return database.registerListener({ statusChanged: onChange })
}

export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(
    subscribe,
    () => database.currentStatus,
    () => null,
  )
}

/** A short, calm word for the header: what the user may want to know, not how sync works. */
export function describeSync(status: SyncStatus | null, online: boolean) {
  if (!status || !online) return null
  const { connected, connecting, dataFlowStatus, hasSynced } = status
  if (dataFlowStatus.uploadError || dataFlowStatus.downloadError) {
    return m.sync_paused()
  }
  if (dataFlowStatus.uploading || dataFlowStatus.downloading || connecting) {
    return m.syncing()
  }
  if (connected && hasSynced) return m.synced()
  return null
}
