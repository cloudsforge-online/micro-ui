/**
 * The sitemap, and the six addresses it must never contain.
 *
 * The whole value of generating a sitemap from the registry is that it cannot list an address the
 * estate does not serve. So most of what is asserted here is an ABSENCE, and each absence is
 * pinned by name as well as swept by field — a sweep over `servesUi` proves the filter works, and
 * naming `nimbus` proves the filter is still being applied to the row everybody remembers.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SURFACES, surface } from './surfaces.ts'
import { SITEMAP_SURFACES, robotsTxt, sitemapUrls, sitemapXml } from './sitemap.ts'

const APEX = 'https://cloudsforge.online'

describe('what is in the sitemap', () => {
  it('lists the front door, the products and the platform surfaces', () => {
    const locs = sitemapUrls(APEX).map((u) => u.loc)
    assert.ok(locs.includes('https://cloudsforge.online'), 'the apex itself is missing')
    for (const key of ['trade', 'market', 'worlds', 'foresight', 'network', 'create'] as const) {
      const s = surface(key)
      assert.ok(locs.includes(`https://${s.subdomain}.cloudsforge.online`), `${key} is missing`)
    }
    assert.ok(locs.length >= 12, `only ${locs.length} URLs in the sitemap`)
  })

  it('composes a basePath surface as a route on the host it actually rides on', () => {
    // `wallet` is `hub./wallet`, not `wallet.<apex>` — the registry's whole point. A sitemap that
    // composed it from the key rather than the subdomain would name a hostname with no DNS record.
    const locs = sitemapUrls(APEX).map((u) => u.loc)
    assert.ok(locs.includes('https://hub.cloudsforge.online/wallet'), 'the wallet is missing')
    assert.ok(locs.includes('https://network.cloudsforge.online/faucet'), 'the faucet is missing')
    assert.ok(!locs.includes('https://wallet.cloudsforge.online'), 'invented a wallet hostname')
  })

  it('appends the apex surface\'s own routes', () => {
    const locs = sitemapUrls(APEX, ['/', '/products', '/about']).map((u) => u.loc)
    assert.ok(locs.includes('https://cloudsforge.online/products'))
    assert.ok(locs.includes('https://cloudsforge.online/about'))
    // '/' is the apex, which the registry already produced. One address, one entry.
    assert.equal(locs.filter((l) => l === 'https://cloudsforge.online').length, 1)
  })

  it('normalises a route table that does not use leading slashes', () => {
    /*
     * `site/src/lib/routes.ts` declares `''`, `'products'`, `'about'` — react-router's shape for a
     * child route. Appended raw those composed `https://cloudsforge.onlineproducts`, which is a
     * hostname that does not exist, in the one document whose whole purpose is to list addresses
     * that do. Found by generating the real sitemap rather than by imagining a caller.
     */
    const locs = sitemapUrls(APEX, ['', 'products', 'about/']).map((u) => u.loc)
    assert.ok(locs.includes('https://cloudsforge.online/products'), locs.join(' '))
    assert.ok(locs.includes('https://cloudsforge.online/about'), 'a trailing slash was not collapsed')
    assert.ok(!locs.some((l) => l.includes('onlineproducts')), 'a path was concatenated onto the host')
    assert.equal(locs.filter((l) => l === 'https://cloudsforge.online').length, 1)
  })

  it('follows whatever origin it is handed, and names no hostname of its own', () => {
    const local = sitemapUrls('http://localhost:3000').map((u) => u.loc)
    assert.ok(local.includes('http://localhost:3000'), 'the apex is missing on a local origin')
    // The port travels with the host, or the local sitemap names a closed port.
    assert.ok(local.includes('http://trade.localhost:3000'), `no trade entry: ${local.join(' ')}`)
    const testnet = sitemapUrls('https://testnet.cloudsforge.online').map((u) => u.loc)
    assert.ok(testnet.every((l) => l.includes('testnet.cloudsforge.online')))
  })
})

describe('what is NOT in the sitemap', () => {
  it('omits every address that serves no page', () => {
    const locs = sitemapUrls(APEX).map((u) => u.loc)
    for (const s of SURFACES) {
      if (s.servesUi) continue
      assert.ok(
        !locs.some((l) => l.startsWith(`https://${s.subdomain}.cloudsforge.online`)),
        `${s.key} is servesUi:false and is in the sitemap`,
      )
    }
  })

  it('omits the six by name, because a sweep can silently stop sweeping', () => {
    const locs = sitemapUrls(APEX).map((u) => u.loc).join(' ')
    for (const host of ['nimbus.', 'account.', 'api.', 'pay.', 'vault.', 'studio.', 'rpc.', 'p2p.']) {
      assert.ok(!locs.includes(host), `${host}cloudsforge.online is in the sitemap`)
    }
  })

  it('omits the operator consoles and the sign-in page', () => {
    const locs = sitemapUrls(APEX).map((u) => u.loc).join(' ')
    for (const host of ['admin.', 'lantern.', 'beacon.']) {
      assert.ok(!locs.includes(host), `${host}cloudsforge.online is in the sitemap`)
    }
    // `signin` rides on hub at /account. The hub entry is correct; the /account one is not.
    assert.ok(!locs.includes('hub.cloudsforge.online/account'), 'the sign-in page is in the sitemap')
    assert.ok(!SITEMAP_SURFACES.some((s) => s.key === 'signin'))
  })
})

describe('the XML', () => {
  it('is a well-formed urlset a crawler will accept', () => {
    const xml = sitemapXml(APEX, ['/', '/about'])
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/)
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
    assert.match(xml, /<\/urlset>\n$/)
    const count = [...xml.matchAll(/<loc>/g)].length
    assert.equal(count, sitemapUrls(APEX, ['/', '/about']).length)
    // Every <loc> is absolute. A relative one is discarded silently by every crawler.
    for (const m of xml.matchAll(/<loc>([^<]*)<\/loc>/g)) {
      assert.match(m[1] ?? '', /^https?:\/\//, `relative <loc>: ${m[1]}`)
    }
  })

  it('escapes what the spec requires escaping', () => {
    const xml = sitemapXml(APEX, ['/search?q=a&b=c'])
    assert.ok(xml.includes('/search?q=a&amp;b=c'), 'an ampersand went through unescaped')
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), 'a bare ampersand survives in the XML')
  })

  it('carries neither changefreq nor priority', () => {
    // Both are ignored by Google and by every other major crawler. A field that is ignored is a
    // field that can only ever be wrong, and it is the field people spend an afternoon tuning.
    const xml = sitemapXml(APEX)
    assert.ok(!xml.includes('changefreq'))
    assert.ok(!xml.includes('priority'))
  })
})

describe('robots.txt', () => {
  it('allows a public surface and points at its sitemap', () => {
    const txt = robotsTxt({ indexable: true, sitemapUrl: `${APEX}/sitemap.xml` })
    assert.match(txt, /^User-agent: \*$/m)
    assert.match(txt, /^Allow: \/$/m)
    assert.match(txt, /^Sitemap: https:\/\/cloudsforge\.online\/sitemap\.xml$/m)
    assert.ok(txt.endsWith('\n'), 'robots.txt must end with a newline')
  })

  it('disallows a surface that is not meant to be indexed', () => {
    const txt = robotsTxt({ indexable: false })
    assert.match(txt, /^Disallow: \/$/m)
    assert.ok(!txt.includes('Allow: /'))
    // No Sitemap line where none was given: a relative one is invalid and an invented absolute one
    // would name a hostname.
    assert.ok(!txt.includes('Sitemap:'))
  })
})
