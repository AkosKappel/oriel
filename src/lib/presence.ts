import { useEffect, useState } from 'react'

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
  const names =
    others.length === 1
      ? others[0]
      : `${others.slice(0, -1).join(', ')} and ${others.at(-1)}`
  return `${names} ${others.length === 1 ? 'is' : 'are'} here too`
}
