import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChoiceGroup } from '#/components/ui/choice-group'
import {
  getReminderKey,
  removeSubscription,
  saveSubscription,
} from '#/server/reminder-functions'

type State =
  | { kind: 'unavailable' }
  | { kind: 'ready'; key: string; subscription: PushSubscription | null }

const choices = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'At 8:00' },
] as const

/**
 * The morning reminder for this device (Web Push). Shown where the browser can receive pushes,
 * the offline worker runs (production builds) and the server has a key; each device opts in on
 * its own, because notifications are a permission of the device.
 */
export function ReminderSetting({
  wrap,
}: {
  /** Renders the setting inside its section, so an unavailable setting leaves no heading. */
  wrap: (setting: ReactNode) => ReactNode
}) {
  const [state, setState] = useState<State>({ kind: 'unavailable' })

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      const key = registration && (await getReminderKey().catch(() => null))
      if (!registration || !key) return
      setState({
        kind: 'ready',
        key,
        subscription: await registration.pushManager.getSubscription(),
      })
    })()
  }, [])

  if (state.kind === 'unavailable') return null

  async function turnOn(key: string) {
    if ((await Notification.requestPermission()) !== 'granted') {
      toast('Notifications are blocked for Oriel in the browser settings.')
      return
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    })
    const { endpoint, keys } = subscription.toJSON()
    await saveSubscription({
      data: {
        endpoint: endpoint ?? '',
        keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    })
    setState({ kind: 'ready', key, subscription })
    toast('Tasks due today will be on this device at 8:00.')
  }

  async function turnOff(key: string, subscription: PushSubscription) {
    await subscription.unsubscribe()
    await removeSubscription({ data: { endpoint: subscription.endpoint } })
    setState({ kind: 'ready', key, subscription: null })
  }

  const { key, subscription } = state
  return wrap(
    <>
      <ChoiceGroup
        label="Morning reminder"
        showLabel
        choices={choices}
        value={subscription ? 'on' : 'off'}
        onChange={(value) => {
          const change =
            value === 'on'
              ? turnOn(key)
              : subscription && turnOff(key, subscription)
          void Promise.resolve(change).catch((error: unknown) => {
            console.error('Could not change the reminder', error)
            toast('That did not work. Check the connection and try again.')
          })
        }}
      />
      <p className="text-sm text-muted-foreground">
        A notification on this device each morning with your open tasks due that
        day, overdue ones included.
      </p>
    </>,
  )
}
