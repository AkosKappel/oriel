import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { database, store } from '#/data/client'
import { SyncConnector } from '#/data/connector'
import type { Owner } from '#/data/schema'
import { authClient } from '#/lib/auth-client'
import { getAccount } from '#/server/account'

/**
 * The signed-in account as this device knows it. Kept in localStorage, so new items get the
 * right owner and the UI knows who is signed in even offline; the session cookie stays the proof
 * for the server.
 */
export type Account = Owner & {
  name: string
  email: string
  /** The session ended on the server (expired or signed out elsewhere): sync waits for sign-in. */
  needsSignIn?: boolean
}

const storageKey = 'oriel.account'
const listeners = new Set<() => void>()
let current: Account | null = read()

function read(): Account | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? (JSON.parse(stored) as Account) : null
  } catch {
    return null
  }
}

function write(account: Account | null) {
  current = account
  store.setOwner(
    account && { userId: account.userId, spaceId: account.spaceId },
  )
  try {
    if (account) localStorage.setItem(storageKey, JSON.stringify(account))
    else localStorage.removeItem(storageKey)
  } catch (error) {
    // Without storage the account still works for this visit.
    console.error('Could not remember the account on this device', error)
  }
  for (const listener of listeners) listener()
}

const connector = new SyncConnector({
  onRejected: (count) =>
    toast(
      `${count} ${count === 1 ? 'change was' : 'changes were'} not accepted by the server and ${count === 1 ? 'was' : 'were'} undone.`,
    ),
  onSignedOut: () => {
    // Keep the data and the owner: signing in again as the same person continues where it was.
    if (current && !current.needsSignIn)
      write({ ...current, needsSignIn: true })
  },
})

function connect() {
  database.connect(connector).catch((error: unknown) => {
    console.error('Could not start sync', error)
  })
}

if (current) {
  store.setOwner({ userId: current.userId, spaceId: current.spaceId })
  connect()
}

export function useAccount() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null,
  )
}

export class DifferentAccountError extends Error {
  constructor() {
    super(
      'This device has notes from another account. Sign out of that account first.',
    )
  }
}

/**
 * Runs after a successful sign-in or sign-up: remembers the account, moves everything made on
 * this device without an account into its personal space, and starts sync. Returns how many
 * items moved.
 */
export async function completeSignIn() {
  const account = await getAccount()
  if (!account) throw new Error('The session was not created. Try again.')
  // The device still holds another account's data (its session expired): never mix the two.
  if (current && current.userId !== account.userId) {
    await authClient.signOut()
    throw new DifferentAccountError()
  }
  write(account)
  const claimed = await store.claimLocalData(account)
  connect()
  return claimed
}

/** Changes made on this device that the server has not received yet. */
export async function pendingChanges() {
  return (await database.getUploadQueueStats()).count
}

const uploadWait = 10_000

/**
 * Signs out and removes this account's data from the device, so the next person to sign in on
 * it does not see or claim it. Waits briefly for pending changes to upload first.
 */
export async function signOut() {
  const deadline = Date.now() + uploadWait
  while ((await pendingChanges()) > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await authClient.signOut()
  write(null)
  await database.disconnectAndClear()
}
