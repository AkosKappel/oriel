import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { z } from 'zod'
import { m } from '#/paraglide/messages.js'
import { auth } from '#/server/auth'
import { listDevices, signOutDevice } from '#/server/sessions'
import { ensurePersonalSpace } from '#/server/spaces'

/**
 * The signed-in user and their personal space, or null when signed out. The client keeps this
 * on the device, so the app knows who owns new items while offline.
 */
export const getAccount = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) return null
    const { id, name, email } = session.user
    return {
      userId: id,
      name,
      email,
      spaceId: await ensurePersonalSpace(id),
    }
  },
)

const signedIn = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) throw new Error(m.err_devices_sign_in())
    return next({
      context: { userId: session.user.id, sessionId: session.session.id },
    })
  },
)

/** Devices signed in to this account, this one marked. */
export const getDevices = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .handler(({ context }) => listDevices(context.userId, context.sessionId))

/** Signs another device out; its next request to the server is refused. */
export const signOutOtherDevice = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ sessionId: z.string().min(1).max(100) }))
  .handler(async ({ data, context }) => {
    if (data.sessionId === context.sessionId) {
      throw new Error(m.err_this_device())
    }
    await signOutDevice(context.userId, data.sessionId)
  })
