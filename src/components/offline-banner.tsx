import { CloudOff } from 'lucide-react'
import { useOnline } from '#/lib/online'

/** A quiet note while offline; editing never stops, so this informs rather than warns. */
export function OfflineBanner() {
  const online = useOnline()
  if (online) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-wash px-4 pt-[max(0.375rem,env(safe-area-inset-top))] pb-1.5 text-xs text-muted-foreground"
    >
      <CloudOff aria-hidden className="size-3.5" />
      Offline. Changes are saved on this device.
    </div>
  )
}
