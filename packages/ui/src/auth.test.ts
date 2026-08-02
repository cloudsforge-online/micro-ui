/**
 * The SSO callback, driven against a stand-in for the service it actually talks to.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ── WHY THIS FILE IS SHAPED LIKE THIS, AND WHAT IT REPLACES ───────────────────────────────────
 *
 * The version before this one asserted:
 *
 *     assert.equal(s.fetched?.url, 'https://nimbus.cloudsforge.online/auth/exchange')
 *
 * That line passed for four months against a client that could not sign anybody in. It read the
 * URL out of the implementation and compared it with a copy of itself, so it was green for every
 * possible value of that URL — including the one that was wrong. **`micro-identity` has never
 * served `/auth/exchange`.** It serves `POST /auth/handoff` and `POST /auth/handoff/redeem`
 * (`identity/src/server.ts:1076`, `:1084`). Every SSO callback in the estate 404'd.
 *
 * A string-equality assertion cannot catch a wrong address, because a wrong address and a right
 * one are both just strings. So the calls below are driven against `identityStub` — a fetch that
 * serves ONLY the routes identity serves and answers 404 to everything else, exactly as identity
 * does. Point the client at a path identity does not have and the redemption comes back null and
 * the test goes red. That is the property the old line did not have.
 *
 * The stub's route table is a second description of identity's and could drift from it. That is
 * not the same failure: it is one table, carrying the `path:line` each entry was read from, that a
 * reader can check in thirty seconds — rather than a literal buried in an assertion that reads as
 * confirmation. The estate has no cross-repository route check yet; when one exists, this table is
 * what it should be compared against.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  consumeAuthCallback,
  handoffReturnUrl,
  mintHandoffCode,
  IDENTITY_AUTH_ROUTES,
} from './index.tsx'

/** A response, in the shape the fetch stub hands back. */
interface Reply {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const reply = (status: number, body: unknown): Reply => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

/**
 * The routes `micro-identity` serves that this module may call, with where each was read from.
 *
 * Anything absent answers 404 with identity's own error envelope
 * (`identity/src/server.ts:1431-1433`), because that is what identity does with a path it does not
 * route — and that is the failure the client hit in production.
 */
const IDENTITY_ROUTES: Record<string, (body: Record<string, unknown>, auth: string | null) => Reply> = {
  // identity/src/server.ts:1076 — mints a 60s single-use code, bound to one redirect origin.
  // Refuses without a user token, and refuses an origin off the allowlist (handoff.ts:31-47).
  'POST /auth/handoff': (body, auth) => {
    // identity verifies the token, so an empty bearer is a 401 rather than an authenticated caller.
    const token = auth?.startsWith('Bearer ') === true ? auth.slice('Bearer '.length) : ''
    if (token === '') return reply(401, { error: { code: 'unauthenticated' } })
    if (typeof body['redirectOrigin'] !== 'string') {
      return reply(400, { error: { code: 'bad_request', message: 'redirectOrigin is required' } })
    }
    if (body['redirectOrigin'] !== 'https://worlds.cloudsforge.online') {
      return reply(403, { error: { code: 'forbidden', message: 'not on the hand-off allowlist' } })
    }
    return reply(201, { code: 'handoff-code-1', expiresInSeconds: 60 })
  },
  // identity/src/server.ts:1084 — spends a code exactly once and answers with a session.
  'POST /auth/handoff/redeem': (body) => {
    if (typeof body['code'] !== 'string' || body['code'] === '') {
      return reply(400, { error: { code: 'bad_request', message: 'code is required' } })
    }
    if (body['code'] !== 'abc123') {
      return reply(401, { error: { code: 'unauthenticated', message: 'that code is invalid' } })
    }
    return reply(200, {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
      user: { id: 'u1', handle: 'ash' },
    })
  },
}

interface Stub {
  /** `replaceState` and `fetch`, in the order they happened. The ordering is an assertion. */
  calls: string[]
  replacedWith: string | null
  fetched: { url: string; body: string; headers: Record<string, string> } | null
}

const g = globalThis as unknown as { window?: unknown; fetch?: unknown }

/**
 * Stand identity up at `nimbus.cloudsforge.online` and put the browser on Hub.
 *
 * `location`, `history` and `fetch` are the whole contract of the callback, so all three are
 * stubbed. An `override` lets one test replace the transport (to make it throw) without giving up
 * the route table.
 */
function identityStub(hash: string, override?: () => Promise<Reply>): Stub {
  const state: Stub = { calls: [], replacedWith: null, fetched: null }
  g.window = {
    location: {
      hostname: 'hub.cloudsforge.online',
      origin: 'https://hub.cloudsforge.online',
      pathname: '/dashboard',
      search: '?tab=all',
      hash,
    },
    history: {
      replaceState(_data: unknown, _title: string, url: string) {
        state.calls.push('replaceState')
        state.replacedWith = url
      },
    },
  }
  g.fetch = async (
    url: string,
    init: { method?: string; body?: string; headers?: Record<string, string> },
  ) => {
    state.calls.push('fetch')
    state.fetched = { url, body: init.body ?? '', headers: init.headers ?? {} }
    if (override) return override()

    const parsed = new URL(url)
    if (parsed.origin !== 'https://nimbus.cloudsforge.online') {
      // Not identity at all. A DNS name with nothing behind it does not answer 404 — it does not
      // answer — so this is thrown rather than returned.
      throw new TypeError(`fetch failed: nothing is served at ${parsed.origin}`)
    }
    const handler = IDENTITY_ROUTES[`${init.method ?? 'GET'} ${parsed.pathname}`]
    if (!handler) {
      return reply(404, {
        error: { code: 'not_found', message: `identity serves no ${parsed.pathname}` },
      })
    }
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    return handler(body, init.headers?.['authorization'] ?? null)
  }
  return state
}

afterEach(() => {
  delete g.window
  delete g.fetch
})

describe('the route table this module speaks', () => {
  it('names the two hand-off routes and nothing else', () => {
    // The stand-in above serves exactly these. If a third route is added to the module it must be
    // added to the stub too, or the call it makes will 404 and its own test will say so.
    assert.deepEqual(Object.keys(IDENTITY_AUTH_ROUTES).sort(), ['handoff', 'handoffRedeem'])
    for (const path of Object.values(IDENTITY_AUTH_ROUTES)) {
      assert.ok(
        `POST ${path}` in IDENTITY_ROUTES,
        `the module calls POST ${path}, which identity does not serve`,
      )
    }
  })
})

describe('consumeAuthCallback', () => {
  it('returns null and sends nothing when there is no hash', async () => {
    const s = identityStub('')
    assert.equal(await consumeAuthCallback(), null)
    assert.deepEqual(s.calls, [])
  })

  it('returns null and sends nothing when the hash carries no code', async () => {
    const s = identityStub('#tab=wallet')
    assert.equal(await consumeAuthCallback(), null)
    assert.deepEqual(s.calls, [])
  })

  it('returns null when there is no window at all (server render)', async () => {
    delete g.window
    assert.equal(await consumeAuthCallback(), null)
  })

  /**
   * THE ONE THAT COULD NOT FAIL BEFORE.
   *
   * Nothing here names a URL. The stand-in serves identity's routes and 404s the rest, so this
   * passes only if the client posted the code somewhere identity would have accepted it. Point
   * `consumeAuthCallback` at `/auth/exchange` — the address that actually shipped — and the stub
   * answers 404, the function returns null, and this assertion is red.
   */
  it('redeems the code at a route identity actually serves', async () => {
    identityStub('#cf_code=abc123')
    assert.deepEqual(await consumeAuthCallback(), {
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 900,
    })
  })

  it('sends the code identity asked for, under the field name identity reads', async () => {
    // Also not a copy of the implementation: the stub 400s a body with no `code`, so a rename on
    // either side is a failure rather than a passing test of a request nobody would accept.
    const s = identityStub('#cf_code=abc123')
    await consumeAuthCallback()
    assert.deepEqual(JSON.parse(s.fetched?.body ?? '{}'), { code: 'abc123' })
  })

  it('reaches identity rather than some other surface', async () => {
    // The host is resolved from the registry, and the stub throws for any other origin — which is
    // what an address with nothing behind it does. `nimbus` was a hostname with no repository
    // behind it for the whole life of the previous version of this file.
    const s = identityStub('#cf_code=abc123')
    await consumeAuthCallback()
    assert.equal(
      new URL(s.fetched?.url ?? 'about:blank').origin,
      'https://nimbus.cloudsforge.online',
    )
  })

  it('strips the code BEFORE it sends the redemption', async () => {
    // A code left in the address bar during a network round trip is a code in the history, in the
    // referrer of the next request the page makes, and in any screenshot taken while the request
    // is in flight. Stripping afterwards also never happens at all if the request throws.
    const s = identityStub('#cf_code=abc123')
    await consumeAuthCallback()
    assert.deepEqual(s.calls, ['replaceState', 'fetch'])
  })

  it('keeps the rest of the hash and the query string', async () => {
    const s = identityStub('#cf_code=abc123&tab=wallet')
    await consumeAuthCallback()
    assert.equal(s.replacedWith, '/dashboard?tab=all#tab=wallet')
  })

  it('leaves no empty hash behind when the code was the whole of it', async () => {
    const s = identityStub('#cf_code=abc123')
    await consumeAuthCallback()
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('tolerates a hash handed over without its leading marker', async () => {
    const s = identityStub('cf_code=abc123')
    assert.equal((await consumeAuthCallback())?.accessToken, 'at')
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('returns null on a code identity refuses, and still strips it', async () => {
    // A spent or expired code. identity answers 401 and says nothing about whether it ever
    // existed; there is nothing for this side to do but report a signed-out boot.
    const s = identityStub('#cf_code=stale')
    assert.equal(await consumeAuthCallback(), null)
    assert.equal(s.replacedWith, '/dashboard?tab=all')
  })

  it('returns null when the redemption throws, and still strips the code', async () => {
    const s = identityStub('#cf_code=abc123', () => Promise.reject(new Error('offline')))
    assert.equal(await consumeAuthCallback(), null)
    assert.equal(s.replacedWith, '/dashboard?tab=all')
    assert.deepEqual(s.calls, ['replaceState', 'fetch'])
  })

  it('refuses an answer that is not a pair of tokens rather than storing undefined', async () => {
    // A 200 from something that is not identity — a gateway's courtesy page, a misrouted deploy.
    // The cast this replaced would have put `undefined` under the access-token key and left the
    // app believing it held a session.
    identityStub('#cf_code=abc123', async () => reply(200, { message: 'hello' }))
    assert.equal(await consumeAuthCallback(), null)
  })
})

describe('mintHandoffCode', () => {
  // The other half of the protocol, used by the sign-in surface. Same stand-in, same property:
  // a wrong route is a 404 and a null, not a green test.
  it('mints a code for an allowed origin', async () => {
    identityStub('')
    assert.equal(await mintHandoffCode('at', 'https://worlds.cloudsforge.online'), 'handoff-code-1')
  })

  it('presents the caller’s session, because identity refuses an unauthenticated mint', async () => {
    const s = identityStub('')
    await mintHandoffCode('at', 'https://worlds.cloudsforge.online')
    assert.equal(s.fetched?.headers['authorization'], 'Bearer at')
  })

  it('returns null for an origin identity will not hand tokens to', async () => {
    // identity refuses at mint rather than issuing a code that could not be redeemed, so the
    // sign-in surface finds out here — before the user is bounced to a page that cannot finish.
    identityStub('')
    assert.equal(await mintHandoffCode('at', 'https://not-ours.example'), null)
  })

  it('returns null rather than a session when the token is not accepted', async () => {
    identityStub('')
    assert.equal(await mintHandoffCode('', 'https://worlds.cloudsforge.online'), null)
  })
})

describe('handoffReturnUrl', () => {
  it('puts the code in the FRAGMENT, which is never sent to a server', () => {
    const url = handoffReturnUrl('https://worlds.cloudsforge.online/player', 'c1')
    assert.equal(url, 'https://worlds.cloudsforge.online/player#cf_code=c1')
    assert.equal(new URL(url).search, '', 'the code must never reach the query string')
  })

  it('keeps the return address’s own path, query and fragment', () => {
    const url = handoffReturnUrl('https://hub.cloudsforge.online/portfolio?tab=all#row=3', 'c1')
    const parsed = new URL(url)
    assert.equal(parsed.pathname, '/portfolio')
    assert.equal(parsed.search, '?tab=all')
    assert.deepEqual(
      [...new URLSearchParams(parsed.hash.slice(1))].sort(),
      [['cf_code', 'c1'], ['row', '3']],
    )
  })

  it('round-trips: what this writes is what consumeAuthCallback reads', async () => {
    // The two ends of the protocol, checked against each other rather than each against a literal.
    const url = handoffReturnUrl('https://hub.cloudsforge.online/portfolio', 'abc123')
    identityStub(new URL(url).hash)
    assert.equal((await consumeAuthCallback())?.accessToken, 'at')
  })
})
