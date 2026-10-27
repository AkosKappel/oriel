import { CloudOff } from 'lucide-react'
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** A quiet note while offline; editing never stops, so this informs rather than warns. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
  if (online) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-secondary px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 text-xs text-muted-foreground"
    >
      <CloudOff aria-hidden className="size-3.5" />
      Offline. Changes are saved on this device.
    </div>
  )
}
