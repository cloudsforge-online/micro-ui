import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { accountSettingsUrl, accountUrl, cloudsforgeHosts, resolveProducts } from './index.tsx'
import { SURFACES } from './surfaces.ts'

/**
 * There is no DOM here, and there does not need to be one.
 *
 * Host resolution reads exactly one field — `window.location.hostname` — and reads it at call
 * time rather than at module load, which is what makes a single build work in dev, in preview and
 * in production. So the test supplies that one field. Standing up jsdom to assert on string
 * concatenation would buy nothing and would hide the fact that the coupling is this small.
 */
const g = globalThis as unknown as { window?: unknown }

function atHostname(hostname: string): void {
  g.window = { location: { hostname, href: `https://${hostname}/`, pathname: '/', search: '' } }
}

afterEach(() => {
  delete g.window
})

describe('cloudsforgeHosts', () => {
  it('uses the local dev ports on localhost', () => {
    atHostname('localhost')
    const hosts = cloudsforgeHosts()
    assert.equal(hosts.hub, 'http://localhost:3010')
    assert.equal(hosts.trade, 'http://localhost:4006')
    assert.equal(hosts.site, 'http://localhost:3000')
  })

  it('uses the local dev ports on 127.0.0.1 and on a .local name', () => {
    atHostname('127.0.0.1')
    assert.equal(cloudsforgeHosts().network, 'http://localhost:3003')
    atHostname('mac-studio.local')
    assert.equal(cloudsforgeHosts().network, 'http://localhost:3003')
  })

  it('uses the local dev ports when there is no window at all (server render)', () => {
    delete g.window
    assert.equal(cloudsforgeHosts().beacon, 'http://localhost:4011')
  })

  it('resolves subdomains from the bare apex', () => {
    atHostname('cloudsforge.online')
    const hosts = cloudsforgeHosts()
    assert.equal(hosts.trade, 'https://trade.cloudsforge.online')
    assert.equal(hosts.hub, 'https://hub.cloudsforge.online')
    // The site has an empty subdomain: it IS the apex, with no stray leading dot.
    assert.equal(hosts.site, 'https://cloudsforge.online')
  })

  it('strips a KNOWN subdomain to find the apex', () => {
    atHostname('worlds.cloudsforge.online')
    const hosts = cloudsforgeHosts()
    assert.equal(hosts.trade, 'https://trade.cloudsforge.online')
    assert.equal(hosts.site, 'https://cloudsforge.online')
  })

  it('leaves an UNKNOWN prefix alone and treats it as the apex', () => {
    // A preview deployment is its own apex. Guessing otherwise would send its sign-in redirect to
    // a hostname that does not exist, which is a broken login rather than a cosmetic defect.
    atHostname('pr-42.previews.example.dev')
    assert.equal(cloudsforgeHosts().trade, 'https://trade.pr-42.previews.example.dev')
  })

  it('appends a basePath to the host the surface actually rides on', () => {
    atHostname('cloudsforge.online')
    assert.equal(cloudsforgeHosts().wallet, 'https://hub.cloudsforge.online/wallet')
    assert.equal(cloudsforgeHosts().faucet, 'https://network.cloudsforge.online/faucet')
    atHostname('localhost')
    assert.equal(cloudsforgeHosts().wallet, 'http://localhost:3010/wallet')
  })

  it('points accountUrl at a surface something serves, not at the token issuer', () => {
    // It used to resolve `account.<apex>`, which nothing in the estate serves and which is not on
    // the gateway's CORS allowlist — so the sign-in page could neither be fetched nor, had it
    // been, call identity. The address has to belong to a bundle that is actually deployed.
    atHostname('cloudsforge.online')
    assert.equal(accountUrl(), 'https://hub.cloudsforge.online/account')
    assert.notEqual(accountUrl(), cloudsforgeHosts().nimbus)
    assert.notEqual(
      accountUrl(),
      cloudsforgeHosts().account,
      'accountUrl must not resolve the reserved `account.` hostname while nothing serves it',
    )
    atHostname('localhost')
    assert.equal(accountUrl(), 'http://localhost:3010/account')
  })

  it('sends the account MENU somewhere a signed-in reader can use, not back to sign-in', () => {
    /*
     * The two addresses are for opposite states and were the same one. The account menu only
     * exists when somebody IS signed in, so resolving it to the sign-in surface offers them the
     * form they have already filled in — which is what the bar did, because the entry's `onClick`
     * was `onSignIn`. `hub-web/test/account-link.test.ts` asserts the rendered anchor; this
     * asserts the address, in both environments, and fails the moment the two collapse again.
     */
    atHostname('cloudsforge.online')
    assert.equal(accountSettingsUrl(), 'https://hub.cloudsforge.online/settings')
    assert.notEqual(
      accountSettingsUrl(),
      accountUrl(),
      'the account menu resolves the sign-in surface again — this is the defect, restored',
    )
    atHostname('localhost')
    assert.equal(accountSettingsUrl(), 'http://localhost:3010/settings')

    // Testnet, because a bundle is promoted rather than rebuilt: one wrong branch here would send
    // every testnet reader's account link at the mainnet estate.
    atHostname('hub-testnet.cloudsforge.online')
    assert.equal(accountSettingsUrl(), 'https://hub-testnet.cloudsforge.online/settings')
  })

  it('keeps the reserved account hostname resolvable, and distinct from the sign-in page', () => {
    // The `account` row stays: six sibling frontends assert it by name, and it is the hostname the
    // portal moves to the day one is served there. It simply is not where anybody is sent today.
    atHostname('cloudsforge.online')
    assert.equal(cloudsforgeHosts().account, 'https://account.cloudsforge.online')
    assert.equal(cloudsforgeHosts().signin, 'https://hub.cloudsforge.online/account')
  })
})

/* ===================== the environment is a SUFFIX ==================== */

/**
 * Testnet's hostnames are `hub-testnet.cloudsforge.online`, not `hub.testnet.cloudsforge.online`.
 *
 * ── WHY THE SHAPE CHANGED, WHICH IS NOT A PREFERENCE ──────────────────────────────────────────
 *
 * Cloudflare's Universal SSL certificate is `*.cloudsforge.online` plus the apex, and a wildcard
 * matches exactly ONE label. `hub.testnet.cloudsforge.online` is two labels deep, so it fails the
 * TLS handshake at Cloudflare's edge before a request ever reaches this estate — testnet was
 * CONFIGURED and UNREACHABLE. Covering it needs Advanced Certificate Manager, which is paid.
 * `hub-testnet.cloudsforge.online` is one label and is already covered.
 *
 * ── THE MODEL THIS FILE PINS ──────────────────────────────────────────────────────────────────
 *
 * The environment used to be a PREFIX ON THE APEX and is now a SUFFIX ON THE SUBDOMAIN:
 *
 *     mainnet   hub.cloudsforge.online            apex cloudsforge.online, no env label
 *     testnet   hub-testnet.cloudsforge.online    apex cloudsforge.online, env label `testnet`
 *
 * Both environments now share one apex, so "strip the first label to find the apex" is no longer
 * enough to keep them apart: the first label carries the environment as well as the surface.
 *
 * ── AND THIS IS WHY THE TEST IS WRITTEN AS A UNIVERSAL RATHER THAN A LIST ─────────────────────
 *
 * The failure being guarded is SILENT. A testnet page that resolves a mainnet sibling produces no
 * error, no failed request and a correct-looking page — with real balances on the other side of
 * it. Asserting a handful of named keys would leave every unasserted key free to leak, and the
 * registry gains rows. So the assertion is over EVERY key in the registry, in both directions:
 *
 *   * no resolved address may be a mainnet address (the leak), and
 *   * every resolved address must be the exact testnet address (an address one level too deep
 *     resolves nothing, which is the `foresight-admin` defect recorded in surfaces.ts,
 *     and it is the failure a naive rename actually produces).
 */
describe('a testnet page resolves testnet siblings and NOTHING on mainnet', () => {
  /** `hub` -> `hub-testnet.cloudsforge.online`; the apex surface -> `testnet.cloudsforge.online`. */
  function testnetHost(sub: string): string {
    return `${sub ? `${sub}-testnet` : 'testnet'}.cloudsforge.online`
  }

  function mainnetHost(sub: string): string {
    return `${sub ? `${sub}.` : ''}cloudsforge.online`
  }

  /** Every registry key, resolved at `hostname`, as {key: hostname-of-the-resolved-URL}. */
  function resolvedHostnames(hostname: string): Record<string, string> {
    atHostname(hostname)
    return Object.fromEntries(
      Object.entries(cloudsforgeHosts()).map(([key, url]) => [key, new URL(url).hostname]),
    )
  }

  for (const page of ['hub-testnet.cloudsforge.online', 'testnet.cloudsforge.online']) {
    it(`resolves no mainnet hostname from ${page}`, () => {
      const mainnet = new Set(SURFACES.map((s) => mainnetHost(s.subdomain)))
      const leaked = Object.entries(resolvedHostnames(page))
        .filter(([, host]) => mainnet.has(host))
        .map(([key, host]) => `${key} -> ${host}`)
      assert.deepEqual(leaked, [], 'a testnet page must resolve no mainnet address')
    })

    it(`resolves the exact testnet hostname for every registry key from ${page}`, () => {
      const resolved = resolvedHostnames(page)
      const wrong = SURFACES.filter((s) => resolved[s.key] !== testnetHost(s.subdomain)).map(
        (s) => `${s.key}: ${resolved[s.key]} (expected ${testnetHost(s.subdomain)})`,
      )
      assert.deepEqual(wrong, [])
    })
  }

  it('keeps the bare testnet apex as testnet, and never lets it become mainnet', () => {
    // The single worst outcome in this whole migration, named so it cannot be reintroduced: the
    // testnet front page resolving every link, every sign-in redirect and every API base to the
    // live estate. `deploy/scripts/check-apex-prefix.py` is the mechanical guard; this is the
    // behavioural one.
    atHostname('testnet.cloudsforge.online')
    assert.equal(cloudsforgeHosts().site, 'https://testnet.cloudsforge.online')
    assert.equal(cloudsforgeHosts().hub, 'https://hub-testnet.cloudsforge.online')
    assert.equal(cloudsforgeHosts().nimbus, 'https://nimbus-testnet.cloudsforge.online')
    assert.equal(accountUrl(), 'https://hub-testnet.cloudsforge.online/account')
  })

  it('has no hyphenated subdomain left, and does not resurrect the one it lost', () => {
    // THIS CASE IS INVERTED ON PURPOSE. It used to assert that `worlds-api-testnet` resolved to
    // the surface `worlds-api` on `testnet` — the one live case for splitting the environment off
    // the LAST hyphen rather than the first. That hostname was retired when the game API was
    // folded into `api.`, and asserting a dead surface exists is how the dead name kept looking
    // alive. So it now asserts the opposite in both directions.
    //
    // The rule itself is unchanged and still `lastIndexOf` (see `splitEnvLabel`); it simply has
    // no case to exercise. This first assertion is what tells you the day that changes.
    assert.deepEqual(
      SURFACES.filter((s) => s.subdomain.includes('-')).map((s) => s.key),
      [],
    )

    // And the retired name is not a surface: `worlds-api` is no longer a known subdomain, so the
    // hostname fails the head check in `splitEnvLabel` and is left alone as its own apex — the
    // same refusal-to-guess as the `pr-42` case below.
    atHostname('worlds-api-testnet.cloudsforge.online')
    assert.equal(cloudsforgeHosts().hub, 'https://hub.worlds-api-testnet.cloudsforge.online')
    assert.ok(!('worlds-api' in cloudsforgeHosts()))
  })

  it('leaves mainnet exactly as it was', () => {
    // The regression direction. Mainnet is live and public; nothing above may touch it.
    for (const page of ['cloudsforge.online', 'hub.cloudsforge.online', 'api.cloudsforge.online']) {
      const resolved = resolvedHostnames(page)
      const wrong = SURFACES.filter((s) => resolved[s.key] !== mainnetHost(s.subdomain)).map(
        (s) => `at ${page}, ${s.key}: ${resolved[s.key]} (expected ${mainnetHost(s.subdomain)})`,
      )
      assert.deepEqual(wrong, [])
    }
  })

  it('does not mistake an ordinary hyphenated hostname for an environment', () => {
    // `pr-42` ends in `-42`, not in an environment label, so it stays its own apex — the preview
    // deployment property the case above this one depends on.
    atHostname('pr-42.previews.example.dev')
    assert.equal(cloudsforgeHosts().trade, 'https://trade.pr-42.previews.example.dev')
    // And a hyphenated label whose tail IS an environment but whose head is not a registry
    // subdomain is not an environment either: guessing would invent a surface.
    atHostname('marketing-testnet.cloudsforge.online')
    assert.equal(cloudsforgeHosts().trade, 'https://trade.marketing-testnet.cloudsforge.online')
  })
})

describe('resolveProducts', () => {
  it('hides operator-only surfaces by default', () => {
    atHostname('localhost')
    assert.deepEqual(
      resolveProducts().map((p) => p.key),
      ['foresight', 'network', 'trade', 'create', 'market', 'worlds'],
    )
  })

  it('reveals them for an admin, below the products', () => {
    atHostname('localhost')
    assert.deepEqual(
      resolveProducts(undefined, true).map((p) => p.key),
      ['foresight', 'network', 'trade', 'create', 'market', 'worlds', 'admin', 'lantern', 'beacon'],
    )
  })

  it('flags only the operator tools as adminOnly', () => {
    atHostname('localhost')
    const flagged = resolveProducts(undefined, true)
      .filter((p) => p.adminOnly)
      .map((p) => p.key)
    assert.deepEqual(flagged, ['admin', 'lantern', 'beacon'])
  })

  it('carries the accent, glyph and blurb through so colour is never the only channel', () => {
    atHostname('localhost')
    for (const p of resolveProducts(undefined, true)) {
      assert.ok(p.glyph.length > 0)
      assert.ok(p.blurb.length > 0)
      assert.match(p.accent, /^#[0-9a-f]{6}$/)
    }
  })

  it('lets an override map win over the resolved host', () => {
    atHostname('cloudsforge.online')
    const products = resolveProducts({ trade: 'https://trade.internal' })
    assert.equal(products.find((p) => p.key === 'trade')?.url, 'https://trade.internal')
    assert.equal(products.find((p) => p.key === 'worlds')?.url, 'https://worlds.cloudsforge.online')
  })
})
