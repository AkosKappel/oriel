import { getLocale } from '#/paraglide/runtime.js'

const sentKey = 'oriel.notification-device'

export const currentZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone

// What the server was last told: the time zone and the language.
const deviceState = (zone: string) => `${zone} ${getLocale()}`

/** Remembers what the server has, so a device that has not changed sends nothing. */
export function rememberZone(zone: string) {
  try {
    localStorage.setItem(sentKey, deviceState(zone))
  } catch {
    // Without storage the state is sent again next time; harmless.
  }
}

/**
 * Keeps notifications in step with the device: after travel or a change of language, tells the
 * server. Only for a device with notifications on; best effort.
 */
export async function refreshNotificationZone() {
  try {
    const zone = currentZone()
    if (localStorage.getItem(sentKey) === deviceState(zone)) return
    const registration = await navigator.serviceWorker?.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return
    const { updateDevice } = await import('#/server/notification-functions')
    await updateDevice({
      data: { endpoint: subscription.endpoint, timeZone: zone },
    })
    rememberZone(zone)
  } catch {
    // Offline or signed out: the next start tries again.
  }
}
