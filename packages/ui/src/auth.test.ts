import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { consumeAuthCallback } from './index.tsx'

/**
 * `location`, `history` and `fetch` are the whole contract of the SSO callback, so all three are
 * stubbed and the ORDER of the calls against them is recorded. The ordering is the point of the
 * test: the hash must be stripped before the exchange is sent, not after it resolves.
 */
interface Stub {
  calls: string[]
  replacedWith: string | null
  fetched: { url: string; body: string } | null
}

const g = globalThis as unknown as { window?: unknown; fetch?: unknown }

function stub(
  hash: string,
  respond: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
): Stub {
  const state: Stub = { calls: [], replacedWith: null, fetched: null }
  g.window = {
    location: { hostname: 'hub.cloudsforge.online', pathname: '/dashboard', search: '?tab=all', hash },
    history: {
      replaceState(_data: unknown, _title: string, url: string) {
        state.calls.push('replaceState')
        state.replacedWith = url
      },
    },
  }
  g.fetch = async (url: string, init: { body: string }) => {
    state.calls.push('fetch')
    state.fetched = { url, body: init.body }
    return respond()
  }
  return state
}

const ok = async () => ({
  ok: true,
  json: async () => ({ accessToken: 'at', refreshToken: 'rt' }),
})

afterEach(() => {
  delete g.window
  delete g.fetch
})

describe('consumeAuthCallback', () => {
  it('returns null and sends nothing when there is no hash', async () => {
    const s = stub('', ok)
    assert.equal(await consumeAuthCallback(), null)
    assert.deepEqual(s.calls, [])
  })

  it('returns null and sends nothing when the hash carries no code', async () => {
    const s = stub('#tab=wallet', ok)
    assert.equal(await consumeAuthCallback(), null)
    assert.deepEqual(s.calls, [])
  })

  it('returns null when there is no window at all (server render)', async () => {
    delete g.window
    assert.equal(await consumeAuthCallback(), null)
  })

  it('exchanges the code for tokens', async () => {
    const s = stub('#cf_code=abc123', ok)
    assert.deepEqual(await consumeAuthCallback(), { accessToken: 'at', refreshToken: 'rt' })
    assert.equal(s.fetched?.url, 'https://nimbus.cloudsforge.online/auth/exchange')
    assert.deepEqual(JSON.parse(s.fetched?.body ?? '{}'), { code: 'abc123' })
  })

  it('strips the code BEFORE it sends the exchange', async () => {
    // A code left in the address bar during a network round trip is a code in the history, in the
    // referrer of the next request the page makes, and in any screenshot taken while the request
    // is in flight. Stripping afterwards also never happens at all if the request throws.
    const s = stub('#cf_code=abc123', ok)
    await consumeAuthCallback()
    assert.deepEqual(s.calls, ['replaceState', 'fetch'])
  })

  it('keeps the rest of the hash and the query string', async () => {
    const s = stub('#cf_code=abc123&tab=wallet', ok)
    await consumeAuthCallback()
    assert.equal(s.replacedWith, '/dashboard?tab=all#tab=wallet')
  })

  it('leaves no empty hash behind when the code was the whole of it', async () => {
    const s = stub('#cf_code=abc123', ok)
    await consumeAuthCallback()
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('tolerates a hash handed over without its leading marker', async () => {
    const s = stub('cf_code=abc123', ok)
    assert.deepEqual(await consumeAuthCallback(), { accessToken: 'at', refreshToken: 'rt' })
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('returns null on a refused exchange, and still strips the code', async () => {
    const s = stub('#cf_code=stale', async () => ({ ok: false, json: async () => ({}) }))
    assert.equal(await consumeAuthCallback(), null)
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('returns null when the exchange throws, and still strips the code', async () => {
    const s = stub('#cf_code=abc123', () => Promise.reject(new Error('offline')))
    assert.equal(await consumeAuthCallback(), null)
    assert.equal(s.replacedWith, '/dashboard?tab=all')
    assert.deepEqual(s.calls, ['replaceState', 'fetch'])
  })
})
