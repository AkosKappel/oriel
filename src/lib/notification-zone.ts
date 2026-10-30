const sentZone = 'oriel.notification-zone'

export const currentZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone

/** Remembers the zone the server has, so a device that has not moved sends nothing. */
export function rememberZone(zone: string) {
  try {
    localStorage.setItem(sentZone, zone)
  } catch {
    // Without storage the zone is sent again next time; harmless.
  }
}

/**
 * Keeps the morning reminder at 08:00 where the device is now: after travel, tells the server the
 * new time zone. Only for a device with notifications on; best effort.
 */
export async function refreshNotificationZone() {
  try {
    const zone = currentZone()
    if (localStorage.getItem(sentZone) === zone) return
    const registration = await navigator.serviceWorker?.getRegistration()
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return
    const { updateTimeZone } = await import('#/server/notification-functions')
    await updateTimeZone({
      data: { endpoint: subscription.endpoint, timeZone: zone },
    })
    rememberZone(zone)
  } catch {
    // Offline or signed out: the next start tries again.
  }
}
