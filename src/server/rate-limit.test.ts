import { describe, expect, it } from 'vitest'
import { createRateLimit } from './rate-limit'

describe('createRateLimit', () => {
  it('allows max requests per window and key, then says how long to wait', () => {
    const check = createRateLimit({ windowMs: 60_000, max: 2 })
    expect(check('anna', 0).allowed).toBe(true)
    expect(check('anna', 1_000).allowed).toBe(true)
    expect(check('anna', 20_000)).toEqual({ allowed: false, retryAfter: 40 })
    expect(check('ben', 20_000).allowed).toBe(true)
    expect(check('anna', 60_000).allowed).toBe(true)
  })
})
