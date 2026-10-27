import { generateKeyPairSync, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { signSyncToken, syncAudience } from './sync-token'

describe('signSyncToken', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const now = Date.UTC(2026, 9, 27, 12)
  const token = signSyncToken({
    userId: 'user-1',
    key: privateKey,
    kid: 'test-key',
    now,
  })
  const [header, payload, signature] = token.split('.')
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString())

  it('is an EdDSA JWT with the key id PowerSync looks up', () => {
    expect(decode(header)).toEqual({
      alg: 'EdDSA',
      typ: 'JWT',
      kid: 'test-key',
    })
  })

  it('names the user and the audience, and expires after 15 minutes', () => {
    expect(decode(payload)).toEqual({
      sub: 'user-1',
      aud: syncAudience,
      iat: now / 1000,
      exp: now / 1000 + 900,
    })
  })

  it('verifies with the public key and fails when tampered with', () => {
    const signed = Buffer.from(`${header}.${payload}`)
    const bytes = Buffer.from(signature, 'base64url')
    expect(verify(null, signed, publicKey, bytes)).toBe(true)
    const forged = Buffer.from(
      `${header}.${Buffer.from(JSON.stringify({ sub: 'someone-else' })).toString('base64url')}`,
    )
    expect(verify(null, forged, publicKey, bytes)).toBe(false)
  })
})
