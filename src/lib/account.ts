import { useSyncExternalStore } from 'react'
import type { Owner } from '#/data/schema'
import { m } from '#/paraglide/messages.js'
import { getAccount } from '#/server/account'

/**
 * The signed-in account as this device knows it. Kept in localStorage, so new items get the
 * right owner and the UI knows who is signed in even offline; the session cookie stays the proof
 * for the server.
 *
 * This module stays light: the local database (`#/data/client`) loads only on the pages that use
 * it, or here when signing in or out, and Better Auth's client only for account actions. The
 * database module starts sync for this account itself.
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
const loadAuth = async () => (await import('#/lib/auth-client')).authClient

// Better Auth's own messages are English; the common ones are said in the page's language.
const authErrors: Record<string, () => string> = {
  INVALID_EMAIL_OR_PASSWORD: m.auth_wrong_credentials,
  INVALID_PASSWORD: m.auth_wrong_credentials,
  USER_ALREADY_EXISTS: m.auth_exists,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: m.auth_exists,
  PASSWORD_TOO_SHORT: m.auth_too_short,
  PASSWORD_TOO_LONG: m.auth_too_long,
  INVALID_EMAIL: m.auth_bad_email,
  SESSION_NOT_FRESH: m.auth_passkey_not_fresh,
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: m.auth_passkey_exists,
  PASSKEY_NOT_FOUND: m.auth_passkey_unknown,
  AUTHENTICATION_FAILED: m.auth_passkey_unknown,
  CHALLENGE_NOT_FOUND: m.error_try_again,
}

/** Older browsers and some in-app browsers have no WebAuthn: passkeys are not offered there. */
export const passkeysSupported = () =>
  typeof window.PublicKeyCredential === 'function'

// The browser's passkey dialog was closed, timed out or replaced by another one: nothing to say.
const passkeyCancellations = new Set([
  'AUTH_CANCELLED',
  'ERROR_CEREMONY_ABORTED',
  'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY',
])

export const passkeyCancelled = (error: {
  code?: string
  message?: string
  status?: number
}) => passkeyCancellations.has(error.code ?? '')

/** A message to show for an error from Better Auth, in the page's language where known. */
export function authErrorMessage(
  error: { code?: string; message?: string; status?: number },
  fallback: string,
) {
  if (error.status === 429) return m.auth_too_many()
  const known = error.code ? authErrors[error.code] : undefined
  return known ? known() : (error.message ?? fallback)
}

export class DifferentAccountError extends Error {
  constructor() {
    super(m.account_other_owner())
  }
}

/**
 * Runs after a successful sign-in or sign-up: remembers the account, moves everything made on
 * this device without an account into its personal space, and starts sync. Returns how many
 * items moved.
 */
export async function completeSignIn() {
  const account = await getAccount()
  if (!account) throw new Error(m.account_no_session())
  // The device still holds another account's data (its session expired): never mix the two.
  if (current && current.userId !== account.userId) {
    await (await loadAuth()).signOut()
    throw new DifferentAccountError()
  }
  write(account)
  const { store, startSync } = await loadClient()
  const claimed = await store.claimLocalData(account)
  startSync()
  return claimed
}

/** Renames the account; spaces show the new name once it syncs. Returns an error message or null. */
export async function changeName(name: string) {
  const { error } = await (await loadAuth()).updateUser({ name })
  if (error) return authErrorMessage(error, m.account_name_failed())
  if (current) write({ ...current, name })
  return null
}

/**
 * Changes the password and signs out every other device (this one gets a new session). Returns
 * an error message (such as a wrong current password) or null.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  const { error } = await (await loadAuth()).changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  })
  if (!error) return null
  return error.code === 'INVALID_PASSWORD'
    ? m.account_wrong_password()
    : authErrorMessage(error, m.account_password_failed())
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
  await stopNotifications()
  await (await loadAuth()).signOut()
  write(null)
  await (await loadClient()).database.disconnectAndClear()
}

/**
 * The device's notifications belong to the account: without this, the next person on the device
 * would get the previous one's reminders. Best effort; signing out goes on regardless.
 */
async function stopNotifications() {
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return
    // The browser first: even offline the device stops receiving, and the server drops its copy
    // when the push service says the subscription is gone.
    await subscription.unsubscribe()
    const { removeSubscription } = await import(
      '#/server/notification-functions'
    )
    await removeSubscription({ data: { endpoint: subscription.endpoint } })
  } catch (error) {
    console.error('Could not turn off notifications', error)
  }
}

/**
 * Deletes the account on the server, then its data on this device. Returns a message the user
 * should read when the server refuses (a wrong password, a space that still needs an owner).
 */
export async function deleteAccount(password: string) {
  const { error } = await (await loadAuth()).deleteUser({ password })
  if (error) return authErrorMessage(error, m.account_delete_failed())
  write(null)
  await (await loadClient()).database.disconnectAndClear()
  return null
}
