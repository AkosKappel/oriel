import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '#/server/auth'
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
