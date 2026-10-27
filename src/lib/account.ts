import { useSyncExternalStore } from 'react'
import { database, store } from '#/data/client'
import type { Owner } from '#/data/schema'
import { authClient } from '#/lib/auth-client'
import { getAccount } from '#/server/account'

/**
 * The signed-in account as this device knows it. Kept in localStorage, so new items get the
 * right owner and the UI knows who is signed in even offline; the session cookie stays the proof
 * for the server.
 */
export type Account = Owner & { name: string; email: string }

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

store.setOwner(current && { userId: current.userId, spaceId: current.spaceId })

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

/**
 * Runs after a successful sign-in or sign-up: remembers the account and moves everything made on
 * this device without an account into its personal space. Returns how many items moved.
 */
export async function completeSignIn() {
  const account = await getAccount()
  if (!account) throw new Error('The session was not created. Try again.')
  write(account)
  return store.claimLocalData(account)
}

/**
 * Signs out and removes this account's data from the device, so the next person to sign in on
 * it does not see or claim it.
 */
export async function signOut() {
  await authClient.signOut()
  write(null)
  await database.disconnectAndClear()
}
