import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

// Notifications (morning reminders, changes by other members): checked every five minutes in this
// one app process. Loaded on the first run, so settings are still checked on first use, not at
// start. The flag keeps Vite's module reloads in development from starting a second timer.
const scheduled = globalThis as { notificationTimer?: NodeJS.Timeout }
scheduled.notificationTimer ??= setInterval(
  () =>
    void import('#/server/notifications').then(({ runNotifications }) =>
      runNotifications(),
    ),
  5 * 60_000,
)

export default createServerEntry({
  fetch: (request, opts) => handler.fetch(request, opts),
})
