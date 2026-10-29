import { describe, expect, it } from 'vitest'
import { loggablePath } from '#/server/request-log'

describe('loggablePath', () => {
  it('drops the query string', () => {
    expect(loggablePath('http://localhost/?q=doctor&type=task')).toBe('/')
  })

  it('masks invite and password-reset tokens', () => {
    expect(loggablePath('http://localhost/invite/abc123')).toBe(
      '/invite/:token',
    )
    expect(
      loggablePath(
        'http://localhost/api/auth/reset-password/abc123?callbackURL=%2F',
      ),
    ).toBe('/api/auth/reset-password/:token')
  })

  it('keeps other paths', () => {
    expect(loggablePath('http://localhost/items/4b7f68dd')).toBe(
      '/items/4b7f68dd',
    )
  })
})
