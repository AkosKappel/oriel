/**
 * Headers for every response (static files, API and pages), set through Nitro route rules in
 * vite.config.ts. The pages' Content-Security-Policy needs a nonce per request, so it is set by
 * the root route instead (`contentSecurityPolicy`).
 */
export const securityHeaders = {
  // Funnel serves Oriel over HTTPS only; browsers ignore this header on plain HTTP (localhost).
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  // Invite links carry their token in the path: never send it to another site.
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
}

/**
 * The pages' policy. Scripts need the request's nonce (TanStack Start's inline hydration data
 * and the theme script) and `wasm-unsafe-eval` to compile SQLite's WebAssembly; workers run
 * PowerSync's database and the service worker; the sync service may live on its own origin.
 * Styles allow inline because the toast library and React set style attributes; scripts are what
 * the policy is for.
 */
export function contentSecurityPolicy(nonce: string, powerSyncUrl?: string) {
  const sync = powerSyncUrl ? new URL(powerSyncUrl) : null
  const syncOrigins = sync
    ? [
        sync.origin,
        `${sync.protocol === 'https:' ? 'wss' : 'ws'}://${sync.host}`,
      ]
    : []
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    ["connect-src 'self'", ...syncOrigins].join(' '),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}
