import { type ReactNode, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ChoiceGroup } from '#/components/ui/choice-group'
import { currentZone, rememberZone } from '#/lib/notification-zone'
import { m } from '#/paraglide/messages.js'
import {
  getDeviceNotifications,
  getNotificationKey,
  removeSubscription,
  saveSubscription,
} from '#/server/notification-functions'

type Choices = { reminders: boolean; changes: boolean }
type State = { key: string; subscription: PushSubscription | null } & Choices

const off: Choices = { reminders: false, changes: false }

/**
 * This device's notifications (Web Push): the morning reminder and changes by other members.
 * Shown where the browser can receive pushes, the offline worker runs (production builds) and the
 * server has a key. Each device opts in on its own, because notifications are a permission of
 * the device.
 */
export function NotificationSettings({
  wrap,
}: {
  /** Renders the settings inside their section, so unavailable settings leave no heading. */
  wrap: (settings: ReactNode) => ReactNode
}) {
  const [state, setState] = useState<State | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      const key = registration && (await getNotificationKey().catch(() => null))
      if (!registration || !key) return
      const subscription = await registration.pushManager.getSubscription()
      const saved =
        subscription &&
        (await getDeviceNotifications({
          data: { endpoint: subscription.endpoint },
        }).catch(() => null))
      setState({ key, subscription, ...(saved ?? off) })
    })()
  }, [])

  if (!state) return null

  async function choose(next: Choices) {
    if (!state) return
    if (!next.reminders && !next.changes) {
      if (state.subscription) {
        await state.subscription.unsubscribe()
        await removeSubscription({
          data: { endpoint: state.subscription.endpoint },
        })
      }
      setState({ ...state, ...next, subscription: null })
      return
    }
    if ((await Notification.requestPermission()) !== 'granted') {
      toast(m.notify_blocked())
      return
    }
    const registration = await navigator.serviceWorker.ready
    const subscription =
      state.subscription ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: state.key,
      }))
    const { endpoint, keys } = subscription.toJSON()
    const zone = currentZone()
    await saveSubscription({
      data: {
        endpoint: endpoint ?? '',
        keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
        timeZone: zone,
        ...next,
      },
    })
    rememberZone(zone)
    setState({ ...state, ...next, subscription })
  }

  function change(next: Partial<Choices>) {
    if (!state) return
    void choose({
      reminders: state.reminders,
      changes: state.changes,
      ...next,
    }).catch((error: unknown) => {
      console.error('Could not change notifications', error)
      toast(m.notify_failed())
    })
  }

  return wrap(
    <>
      <ChoiceGroup
        label={m.notify_morning()}
        showLabel
        choices={[
          { value: 'off', label: m.notify_off() },
          { value: 'on', label: m.notify_at_eight() },
        ]}
        value={state.reminders ? 'on' : 'off'}
        onChange={(value) => change({ reminders: value === 'on' })}
      />
      <ChoiceGroup
        label={m.notify_changes()}
        showLabel
        choices={[
          { value: 'off', label: m.notify_off() },
          { value: 'on', label: m.notify_on() },
        ]}
        value={state.changes ? 'on' : 'off'}
        onChange={(value) => change({ changes: value === 'on' })}
      />
      <p className="text-sm text-muted-foreground">{m.notify_help()}</p>
    </>,
  )
}
