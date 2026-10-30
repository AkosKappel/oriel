import { createMiddleware } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { m } from '#/paraglide/messages.js'
import { auth } from '#/server/auth'

/** For server functions that need an account: the signed-in user, or an error to show. */
export const signedIn = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const session = await auth.api.getSession({ headers: getRequestHeaders() })
    if (!session) throw new Error(m.err_sign_in_first())
    return next({
      context: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    })
  },
)
