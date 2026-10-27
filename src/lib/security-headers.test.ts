import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from './security-headers'

describe('contentSecurityPolicy', () => {
  it('allows scripts only with the nonce, and the sync service over HTTP and WebSockets', () => {
    const policy = contentSecurityPolicy('abc123', 'https://sync.example.com/')
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc123' 'wasm-unsafe-eval'",
    )
    expect(policy).toContain(
      "connect-src 'self' https://sync.example.com wss://sync.example.com",
    )
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'")
  })

  it('connects only to its own origin without a sync service', () => {
    expect(contentSecurityPolicy('n')).toContain("connect-src 'self';")
  })
})
