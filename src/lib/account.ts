import { useSyncExternalStore } from 'react'
import type { Owner } from '#/data/schema'
import { authClient } from '#/lib/auth-client'
import { getAccount } from '#/server/account'

/**
 * The signed-in account as this device knows it. Kept in localStorage, so new items get the
 * right owner and the UI knows who is signed in even offline; the session cookie stays the proof
 * for the server.
 *
 * This module stays light: the local database (`#/data/client`) loads only on the pages that use
 * it, or here when signing in or out. The database module starts sync for this account itself.
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
  try {
    if (account) localStorage.setItem(storageKey, JSON.stringify(account))
    else localStorage.removeItem(storageKey)
  } catch (error) {
    // Without storage the account still works for this visit.
    console.error('Could not remember the account on this device', error)
  }
  for (const listener of listeners) listener()
}

export const currentAccount = () => current

/** Calls `onChange` whenever the account changes; returns the unsubscribe function. */
export function subscribeAccount(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** The server no longer accepts the session: keep the data, wait for sign-in as the same person. */
export function markNeedsSignIn() {
  if (current && !current.needsSignIn) write({ ...current, needsSignIn: true })
}

export function useAccount() {
  return useSyncExternalStore(
    subscribeAccount,
    () => current,
    () => null,
  )
}

const loadClient = () => import('#/data/client')

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
  const { store, startSync } = await loadClient()
  const claimed = await store.claimLocalData(account)
  startSync()
  return claimed
}

/** Changes made on this device that the server has not received yet. */
export async function pendingChanges() {
  const { database } = await loadClient()
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
  await (await loadClient()).database.disconnectAndClear()
}

/**
 * Deletes the account on the server, then its data on this device. Returns a message the user
 * should read when the server refuses (a wrong password, a space that still needs an owner).
 */
export async function deleteAccount(password: string) {
  const { error } = await authClient.deleteUser({ password })
  if (error) return error.message ?? 'Could not delete the account. Try again.'
  write(null)
  await (await loadClient()).database.disconnectAndClear()
  return null
}
