/**
 * A fixed-window counter per key (a user id), kept in memory. Enough for one server process; the
 * counts reset when it restarts. Returns how many seconds to wait once the limit is reached.
 */
export function createRateLimit({
  windowMs,
  max,
}: {
  windowMs: number
  max: number
}) {
  const windows = new Map<string, { start: number; count: number }>()

  return function check(key: string, now = Date.now()) {
    const current = windows.get(key)
    if (!current || now - current.start >= windowMs) {
      // Old windows are only cleared when the map grows, so idle users cost nothing.
      if (windows.size >= 10_000) {
        for (const [oldKey, old] of windows) {
          if (now - old.start >= windowMs) windows.delete(oldKey)
        }
      }
      windows.set(key, { start: now, count: 1 })
      return { allowed: true as const }
    }
    current.count += 1
    if (current.count <= max) return { allowed: true as const }
    return {
      allowed: false as const,
      retryAfter: Math.ceil((current.start + windowMs - now) / 1000),
    }
  }
}

/** The answer when a limit is reached; the sync connector retries it later like any failure. */
export const tooManyRequests = (retryAfter: number) =>
  Response.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  )
