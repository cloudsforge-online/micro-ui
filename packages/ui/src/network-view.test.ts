import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  NETWORK_QUERY_PARAM,
  currentNetwork,
  networkFromQuery,
  resolveProducts,
  siblingNetworkUrl,
  viewingSurfaceUrl,
  withNetwork,
} from './index.tsx'
import { SURFACES, VIEWING_SURFACES } from './surfaces.ts'

/**
 * THE BUG THIS FILE EXISTS FOR, in the owner's words:
 *
 *     "if you select testnet and switch product you are back to mainnet"
 *
 * Under the combined view every surface is its own ORIGIN and the testnet frontends are retired,
 * so the reader's choice lives in one bundle's module memory and `market-testnet.<apex>` 302s to
 * `market.<apex>`. Neither storage nor the hostname can carry a choice across a product switch;
 * `?net=` is the only channel left. These tests pin both halves of that: the surfaces that CAN
 * honour it get it, and the surfaces that cannot are marked rather than quietly re-pointed.
 *
 * No DOM. Everything here reads exactly one field — `window.location` — at call time, which is
 * what lets one build serve dev, preview and production, so the test supplies that one field.
 */
const g = globalThis as unknown as { window?: unknown }

function atUrl(hostname: string, pathname = '/', search = ''): void {
  g.window = { location: { hostname, pathname, search, href: `https://${hostname}${pathname}${search}` } }
}

afterEach(() => {
  delete g.window
})

describe('currentNetwork', () => {
  it('reads the network off the hostname on both estates', () => {
    atUrl('cloudsforge.online')
    assert.equal(currentNetwork(), 'mainnet')
    atUrl('hub.cloudsforge.online')
    assert.equal(currentNetwork(), 'mainnet')
    atUrl('testnet.cloudsforge.online')
    assert.equal(currentNetwork(), 'testnet')
    atUrl('hub-testnet.cloudsforge.online')
    assert.equal(currentNetwork(), 'testnet')
  })

  it('answers null where the question has no answer', () => {
    // A control that guesses is worse than no control: the switcher hides itself on null.
    atUrl('localhost')
    assert.equal(currentNetwork(), null)
    atUrl('127.0.0.1')
    assert.equal(currentNetwork(), null)
    delete g.window
    assert.equal(currentNetwork(), null)
  })
})

describe('networkFromQuery', () => {
  it('reads either network out of a query string', () => {
    assert.equal(networkFromQuery('?net=testnet'), 'testnet')
    assert.equal(networkFromQuery('?net=mainnet'), 'mainnet')
    assert.equal(networkFromQuery('?asset=ltc&net=testnet&page=2'), 'testnet')
  })

  it('answers null for absent and for nonsense, never a default', () => {
    // `?net=maiinet` is a typo or a probe. "This URL says nothing" leaves the bundle on its own
    // hostname's network; defaulting a bad value to testnet would let a malformed link change
    // what a signed-in page shows.
    assert.equal(networkFromQuery(''), null)
    assert.equal(networkFromQuery('?asset=ltc'), null)
    assert.equal(networkFromQuery('?net=maiinet'), null)
    assert.equal(networkFromQuery('?net='), null)
    assert.equal(networkFromQuery('?net=MAINNET'), null)
  })

  it('falls back to the current address when given no argument', () => {
    atUrl('hub.cloudsforge.online', '/wallet', '?net=testnet')
    assert.equal(networkFromQuery(), 'testnet')
    atUrl('hub.cloudsforge.online', '/wallet', '')
    assert.equal(networkFromQuery(), null)
    delete g.window
    assert.equal(networkFromQuery(), null)
  })
})

describe('withNetwork', () => {
  it('attaches the network and keeps the rest of the address intact', () => {
    assert.equal(
      withNetwork('https://market.cloudsforge.online/products?tag=rare', 'testnet'),
      'https://market.cloudsforge.online/products?tag=rare&net=testnet',
    )
  })

  it('overwrites rather than appends, so a chained link cannot say both', () => {
    const once = withNetwork('https://explorer.cloudsforge.online/?net=testnet', 'mainnet')
    assert.equal(once, 'https://explorer.cloudsforge.online/?net=mainnet')
    assert.equal(new URL(once).searchParams.getAll(NETWORK_QUERY_PARAM).length, 1)
  })

  it('leaves a relative link alone', () => {
    // Relative stays on this origin, where the network is already whatever this page decided.
    assert.equal(withNetwork('/wallet', 'testnet'), '/wallet')
    assert.equal(withNetwork('', 'testnet'), '')
  })
})

describe('siblingNetworkUrl', () => {
  it('carries the request through the retirement redirect', () => {
    // `hub-testnet.<apex>` 302s to `hub.<apex>` preserving path AND query, which is what turns
    // this from a round trip back to mainnet into a request the destination bundle can honour.
    atUrl('hub.cloudsforge.online', '/wallet', '?asset=ltc')
    assert.equal(
      siblingNetworkUrl('testnet'),
      'https://hub-testnet.cloudsforge.online/wallet?asset=ltc&net=testnet',
    )
  })

  it('carries it back the other way, from the apex too', () => {
    atUrl('testnet.cloudsforge.online', '/', '')
    assert.equal(siblingNetworkUrl('mainnet'), 'https://cloudsforge.online/?net=mainnet')
  })

  it('answers null when there is nowhere to go', () => {
    atUrl('hub.cloudsforge.online')
    assert.equal(siblingNetworkUrl('mainnet'), null) // already there
    atUrl('localhost')
    assert.equal(siblingNetworkUrl('testnet'), null) // no network to leave
  })
})

describe('resolveProducts and the viewed network', () => {
  it('is byte-for-byte unchanged when no network is being viewed', () => {
    // Every surface that has not adopted the in-app switcher passes nothing, and must stay as it
    // was. This is the regression guard for the other nineteen menus.
    atUrl('cloudsforge.online')
    assert.deepEqual(resolveProducts(undefined, true), resolveProducts(undefined, true, 'mainnet'))
  })

  it('carries the choice to the surfaces whose bundle can show it', () => {
    atUrl('cloudsforge.online')
    const products = resolveProducts(undefined, false, 'testnet')
    const network = products.find((p) => p.key === 'network')
    assert.equal(network?.url, 'https://network.cloudsforge.online/?net=testnet')
    assert.equal(network?.pinnedNetwork, undefined)
  })

  it('marks the surfaces whose bundle cannot, instead of linking them silently', () => {
    // The honest half, and not a stopgap: there is nowhere to send a reader to see testnet Forge
    // Market. Linking it anyway is the reported bug; attaching a parameter it ignores is the same
    // silence with a longer URL.
    atUrl('cloudsforge.online')
    const market = resolveProducts(undefined, false, 'testnet').find((p) => p.key === 'market')
    assert.equal(market?.url, 'https://market.cloudsforge.online')
    assert.equal(market?.pinnedNetwork, 'mainnet')
  })

  it('marks them with the network they WILL show, from either estate', () => {
    atUrl('testnet.cloudsforge.online')
    const products = resolveProducts(undefined, false, 'mainnet')
    assert.equal(
      products.find((p) => p.key === 'network')?.url,
      'https://network-testnet.cloudsforge.online/?net=mainnet',
    )
    assert.equal(products.find((p) => p.key === 'market')?.pinnedNetwork, 'testnet')
  })

  it('marks nothing when the viewed network is the one being served', () => {
    // "Mainnet only" on nineteen entries of a mainnet menu is a label that says nothing.
    atUrl('cloudsforge.online')
    for (const p of resolveProducts(undefined, true, 'mainnet')) {
      assert.equal(p.pinnedNetwork, undefined)
    }
  })

  it('does neither off-registry, where there is no other network', () => {
    atUrl('localhost')
    for (const p of resolveProducts(undefined, true, 'testnet')) {
      assert.equal(p.pinnedNetwork, undefined)
      assert.ok(!p.url.includes('net='))
    }
  })

  it('lets an override map win, and still carries onto it', () => {
    atUrl('cloudsforge.online')
    const products = resolveProducts({ network: 'https://network.internal/' }, false, 'testnet')
    assert.equal(products.find((p) => p.key === 'network')?.url, 'https://network.internal/?net=testnet')
  })
})

describe('the viewing registry', () => {
  it('names only surfaces that serve a UI', () => {
    // `viewsAnyNetwork` promises a bundle re-points its reads in place. An API has no bundle, so
    // a true here would promise a view nothing renders — and micro-deploy reads this field to
    // decide which origins get a credentialed cross-environment grant.
    assert.ok(VIEWING_SURFACES.length > 0)
    for (const s of VIEWING_SURFACES) assert.equal(s.servesUi, true)
  })

  it('is exactly the surfaces flagged on the registry, in registry order', () => {
    assert.deepEqual(
      VIEWING_SURFACES.map((s) => s.key),
      SURFACES.filter((s) => s.viewsAnyNetwork === true).map((s) => s.key),
    )
  })

  it('names the three bundles that carry a lib/viewed.ts', () => {
    // Hard-coded on purpose. A fourth bundle gaining an in-place view is a deploy-side CORS grant
    // and a product-menu link, so it should be a line someone changed, not a list that grew.
    assert.deepEqual(VIEWING_SURFACES.map((s) => s.key), ['network', 'hub', 'explorer'])
  })
})

/**
 * THE SECOND REPORT, which the first fix did not reach:
 *
 *     "after your latest change im not able at all to change to testnet. reload directly to
 *      mainnet"
 *
 * The product switcher learned about `viewsAnyNetwork`; the NETWORK switcher did not. On the
 * sixteen surfaces without an in-place view it still fell through to `siblingNetworkUrl`, which
 * composes a retired hostname — so pressing Testnet was a 302 back to the page you were on. These
 * pin the escape route that replaces it.
 */
describe('the escape route from a surface that cannot show the other network', () => {
  it('sends a pinned surface to Forge Network, carrying the choice', () => {
    atUrl('cloudsforge.online')
    assert.equal(
      viewingSurfaceUrl('site', 'testnet'),
      'https://network.cloudsforge.online/?net=testnet',
    )
    atUrl('market.cloudsforge.online', '/listings')
    assert.equal(
      viewingSurfaceUrl('market', 'testnet'),
      'https://network.cloudsforge.online/?net=testnet',
    )
  })

  it('answers null on a surface that views in place, which keeps its own switch', () => {
    // These three pass `onSelect` and switch the DATA without navigating. An escape URL here would
    // be a second, worse answer to a question the bundle already answers correctly.
    atUrl('network.cloudsforge.online')
    for (const key of ['network', 'hub', 'explorer'] as const) {
      assert.equal(viewingSurfaceUrl(key, 'testnet'), null)
    }
  })

  it('is a real destination on both estates, and never the retired hostname', () => {
    // The whole point: whatever this returns must not be a `-testnet` host, because that is the
    // hostname the combined view redirects and the redirect is what produced the report.
    atUrl('wallet.cloudsforge.online', '/deposit')
    const url = viewingSurfaceUrl('wallet', 'testnet')
    assert.ok(url !== null)
    assert.ok(!new URL(url).hostname.includes('-testnet'))
    assert.equal(networkFromQuery(new URL(url).search), 'testnet')
  })

  it('honours an operator override for the surface it sends to', () => {
    atUrl('cloudsforge.online')
    assert.equal(
      viewingSurfaceUrl('site', 'testnet', { network: 'https://net.example/' }),
      'https://net.example/?net=testnet',
    )
  })

  it('carries mainnet the same way, for a reader who got there on a testnet link', () => {
    atUrl('cloudsforge.online', '/', '?net=testnet')
    assert.equal(
      viewingSurfaceUrl('site', 'mainnet'),
      'https://network.cloudsforge.online/?net=mainnet',
    )
  })
})
