import { useEffect, useState } from 'react'
import { formatLocale } from '#/lib/locale'
import { m } from '#/paraglide/messages.js'

/**
 * The other members who have this shared item open, live (server-sent events from
 * /api/presence). Empty while offline or for personal items; the browser reconnects by itself.
 */
export function usePresence(itemId: string, shared: boolean) {
  const [others, setOthers] = useState<string[]>([])

  useEffect(() => {
    setOthers([])
    if (!shared || typeof EventSource === 'undefined') return
    const source = new EventSource(
      `/api/presence?item=${encodeURIComponent(itemId)}`,
    )
    source.onmessage = (event) => {
      try {
        const names: unknown = JSON.parse(event.data)
        if (Array.isArray(names))
          setOthers(names.filter((n) => typeof n === 'string'))
      } catch {
        // A malformed message changes nothing.
      }
    }
    source.onerror = () => setOthers([])
    return () => source.close()
  }, [itemId, shared])

  return others
}

/** "Anna is here too", "Anna and Ben are here too". */
export function presenceText(others: string[]) {
  if (others.length === 0) return null
  const names = new Intl.ListFormat(formatLocale(), {
    type: 'conjunction',
  }).format(others)
  return m.presence_here({ names, count: others.length })
}
