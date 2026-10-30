import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

// Morning reminders: checked every quarter hour in this one app process. Loaded on the first run,
// so settings are still checked on first use, not at start. The flag keeps Vite's module reloads
// in development from starting a second timer.
const scheduled = globalThis as { reminderTimer?: NodeJS.Timeout }
scheduled.reminderTimer ??= setInterval(
  () =>
    void import('#/server/reminders').then(({ runReminders }) =>
      runReminders(),
    ),
  15 * 60_000,
)

export default createServerEntry({
  fetch: (request, opts) => handler.fetch(request, opts),
})
