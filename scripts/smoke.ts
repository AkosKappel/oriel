// Post-deploy smoke test: `node scripts/smoke.ts https://oriel.tailb52c43.ts.net`.
// Checks the app, its security headers and the sync service behind the same origin, without
// creating anything. Exits non-zero on the first failure.

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')

async function check(name: string, run: () => Promise<string | undefined>) {
  const started = performance.now()
  try {
    const detail = await run()
    const ms = Math.round(performance.now() - started)
    console.log(`ok   ${name} (${ms} ms)${detail ? `: ${detail}` : ''}`)
  } catch (error) {
    console.error(`FAIL ${name}: ${(error as Error).message}`)
    process.exit(1)
  }
}

function expectStatus(response: Response, status: number) {
  if (response.status !== status)
    throw new Error(`expected ${status}, got ${response.status}`)
}

await check('health', async () => {
  const response = await fetch(`${base}/api/health`)
  expectStatus(response, 200)
  return JSON.stringify(await response.json())
})

await check('sign-in page', async () => {
  const response = await fetch(`${base}/sign-in`)
  expectStatus(response, 200)
  const policy = response.headers.get('content-security-policy')
  if (!policy?.includes("script-src 'self' 'nonce-"))
    throw new Error('no Content-Security-Policy with a nonce')
  if (!response.headers.get('strict-transport-security'))
    throw new Error('no Strict-Transport-Security header')
})

// 401 means the endpoint runs and sync is configured; 503 would mean the sync keys are missing.
await check('sync token without a session', async () => {
  const response = await fetch(`${base}/api/sync/token`)
  expectStatus(response, 401)
})

await check('sync service', async () => {
  const response = await fetch(`${base}/powersync/probes/liveness`)
  expectStatus(response, 200)
})

// Server functions must refuse calls from other sites; any server function path will do.
await check('cross-site server function call refused', async () => {
  const response = await fetch(`${base}/_serverFn/any-function`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sec-fetch-site': 'cross-site',
    },
    body: '{}',
  })
  expectStatus(response, 403)
})

await check('not found', async () => {
  const response = await fetch(`${base}/no-such-page`)
  expectStatus(response, 404)
})

// Top-level await needs a module.
export {}
