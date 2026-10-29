// Invite links and Better Auth's password-reset callback carry single-use tokens in the path.
const secretPaths = [
  /^(\/invite\/)[^/]+/,
  /^(\/api\/auth\/reset-password\/)[^/]+/,
]

/** The path as it may be logged: the query string dropped (search text), tokens masked. */
export function loggablePath(url: string) {
  const { pathname } = new URL(url)
  return secretPaths.reduce(
    (path, pattern) => path.replace(pattern, '$1:token'),
    pathname,
  )
}
