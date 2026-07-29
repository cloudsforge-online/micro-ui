import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { accountUrl, cloudsforgeHosts, resolveProducts } from './index.tsx'

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

  it('points accountUrl at the sign-in hostname, not at the token issuer', () => {
    atHostname('cloudsforge.online')
    assert.equal(accountUrl(), 'https://account.cloudsforge.online')
    assert.notEqual(accountUrl(), cloudsforgeHosts().nimbus)
  })
})

describe('resolveProducts', () => {
  it('hides operator-only surfaces by default', () => {
    atHostname('localhost')
    assert.deepEqual(
      resolveProducts().map((p) => p.key),
      ['network', 'trade', 'create', 'market', 'worlds'],
    )
  })

  it('reveals them for an admin, below the products', () => {
    atHostname('localhost')
    assert.deepEqual(
      resolveProducts(undefined, true).map((p) => p.key),
      ['network', 'trade', 'create', 'market', 'worlds', 'admin', 'lantern', 'beacon'],
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
