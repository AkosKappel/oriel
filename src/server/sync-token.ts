import { createPrivateKey, type KeyObject, sign } from 'node:crypto'

/** Matches `client_auth.audience` in powersync/service.yaml. */
export const syncAudience = 'oriel'

/** Short-lived: PowerSync asks for a new one through the connector before it expires. */
const lifetimeSeconds = 15 * 60

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString('base64url')

export function loadSigningKey(base64Pem: string) {
  return createPrivateKey(Buffer.from(base64Pem, 'base64').toString('utf8'))
}

/**
 * An EdDSA (Ed25519) JWT for the PowerSync Service. `sub` is what `auth.user_id()` returns in
 * the sync streams, so it decides which spaces the device receives.
 */
export function signSyncToken({
  userId,
  key,
  kid,
  now = Date.now(),
}: {
  userId: string
  key: KeyObject
  kid: string
  now?: number
}) {
  const issuedAt = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid }))
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      aud: syncAudience,
      iat: issuedAt,
      exp: issuedAt + lifetimeSeconds,
    }),
  )
  const signature = sign(null, Buffer.from(`${header}.${payload}`), key)
  return `${header}.${payload}.${base64url(signature)}`
}
