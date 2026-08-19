import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  NETWORK_QUERY_PARAM,
  cloudsforgeHosts,
  currentNetwork,
  networkFromQuery,
  resolveProducts,
  siblingNetworkUrl,
  viewingSurfaceUrl,
  withNetwork,
} from './index.tsx'
import { createNetworkView } from './network-view.ts'
import { SURFACES, VIEWING_SURFACES, servesOwnBundle, type SurfaceKey } from './surfaces.ts'
import { apiBaseFor } from './index.tsx'

/**
 * Where the REGISTRY puts a product, composed the way `resolveProducts` composes it.
 *
 * These assertions used to spell hostnames. That is the failure this migration keeps producing —
 * a fixture naming an address the registry owns, which goes red for a change its own repository
 * did not make. Derived from the row, so the next surface to move does not touch this file.
 *
 * The apex is spelled out because the registry does not hold it: `subdomain: ''` means "the apex",
 * and WHICH apex is the thing these two tests differ on. A root-mounted surface keeps its trailing
 * slash; a path-mounted one has none, which is why the caller appends `?net=` directly.
 */
function productBase(key: string, apex: string): string {
  const row = SURFACES.find((s) => s.key === key)
  if (!row) throw new Error(`the registry has no \`${key}\` surface`)
  const host = row.subdomain === '' ? apex : `${row.subdomain}.${apex}`
  return row.basePath ? `https://${host}${row.basePath}` : `https://${host}/`
}

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

  it('carries it to every product, now that every product bundle can honour it', () => {
    // This assertion USED to be its opposite: `market` was marked "mainnet only" because there was
    // nowhere to send a reader to see testnet Forge Market. The owner's reply to that arrangement —
    // "in every page when you press testnet it take you to network page testet and if you switch
    // product its reset to mainnet" — is why every bundle now views in place instead.
    atUrl('cloudsforge.online')
    const market = resolveProducts(undefined, false, 'testnet').find((p) => p.key === 'market')
    // DERIVED, not typed. `market` moved to `<apex>/market` in wave 3 and this assertion spelled
    // its hostname — the same shape that turned micro-hub-web's `main` red for a change hub-web
    // did not make. What the test is FOR is that the product URL carries `?net=`, and that needs
    // no hostname written here.
    assert.equal(market?.url, `${productBase('market', 'cloudsforge.online')}?net=testnet`)
    assert.equal(market?.pinnedNetwork, undefined)
  })

  it('marks nothing in the switcher any more, and links everything', () => {
    // "Mainnet only" is a real state and `pinnedNetwork` keeps rendering it — but no entry is in it
    // now, because every switcher surface is a bundle and every bundle views in place. This is the
    // menu the owner will see: nine products, all nine following the choice they just made.
    atUrl('cloudsforge.online')
    for (const p of resolveProducts(undefined, true, 'testnet')) {
      assert.equal(p.pinnedNetwork, undefined, p.key)
      assert.equal(networkFromQuery(new URL(p.url).search), 'testnet', p.key)
    }
  })

  it('carries it from either estate', () => {
    atUrl('testnet.cloudsforge.online')
    const products = resolveProducts(undefined, false, 'mainnet')
    assert.equal(
      products.find((p) => p.key === 'network')?.url,
      'https://network-testnet.cloudsforge.online/?net=mainnet',
    )
    assert.equal(
      products.find((p) => p.key === 'market')?.url,
      `${productBase('market', 'testnet.cloudsforge.online')}?net=mainnet`,
    )
    assert.equal(products.find((p) => p.key === 'market')?.pinnedNetwork, undefined)
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

  it('is every bundle that serves a UI of its own', () => {
    // The escape route is gone, so this is no longer a short list somebody curates: a frontend that
    // cannot show the other network has no answer for a reader who presses Testnet. Anything here
    // that is NOT flagged is a bundle that will fall back to `viewingSurfaceUrl`, which is the
    // behaviour the owner reported as a bug.
    //
    // THE PREDICATE USED TO BE `!s.basePath`, WHICH WAS THE SAME SET UNTIL 2026-08-19. Every
    // basePath row was then a route inside another surface's bundle. `journal` is the first that
    // is not — its own repository, mounted by the gateway at a path on the apex — and dropping it
    // from this list to keep the old predicate would have dropped, for a bundle that has one, the
    // micro-deploy check that its `src/lib/viewed.ts` exists. Thirteen more follow it.
    const bundles = SURFACES.filter(servesOwnBundle).map((s) => s.key)
    assert.deepEqual(VIEWING_SURFACES.map((s) => s.key), bundles)
  })

  it('leaves out the basePath rows that ride inside somebody else’s bundle', () => {
    // `wallet` and `signin` are routes inside Forge Hub; `faucet` is a route on the Network site.
    // A row of their own would claim a view for a bundle that is not theirs, and would put a
    // DUPLICATE origin in the cross-environment CORS grant, which is keyed by origin and which
    // `hub` and `network` are already in.
    for (const key of ['wallet', 'signin', 'faucet'] as const) {
      assert.equal(SURFACES.find((s) => s.key === key)?.viewsAnyNetwork, undefined)
    }
    // Uniqueness OF THE BUNDLE, which is what the flag is about — this used to assert uniqueness of
    // the SUBDOMAIN, and the apex consolidation is what showed the difference. Two viewers may now
    // share an origin (`site` and `journal` both serve from `cloudsforge.online`) and the grant
    // dedupes them; two viewers sharing a dev port would mean one bundle flagged twice, which is
    // the thing that was actually being prevented.
    const ports = VIEWING_SURFACES.map((s) => s.devPort)
    assert.equal(new Set(ports).size, ports.length)
  })
})

/**
 * THE ESCAPE ROUTE, WHICH IS NOW UNREACHABLE FROM ANY SHIPPED BUNDLE — and these are what say so.
 *
 * It was the answer to the second report ("after your latest change im not able at all to change
 * to testnet. reload directly to mainnet"): a surface that could not view sent the reader to Forge
 * Network on testnet instead of composing a retired hostname. It fixed the 302, and the owner
 * measured what it was actually like:
 *
 *     "i see basically that in every page when you press testnet it take you to network page
 *      testet and if you switch product its reset to mainnet"
 *
 * So every frontend gained the in-place view and `viewingSurfaceUrl` answers null for all of them.
 * The function STAYS, and the first test below is the reason: the day a twentieth bundle joins the
 * estate without a `lib/viewed.ts`, its Testnet button needs to do something better than reload the
 * page it is on. What must never come back is a shipped surface reaching it.
 */
describe('the escape route from a surface that cannot show the other network', () => {
  it('is reached by nothing that serves a UI', () => {
    // The regression guard for the whole change. If this fails, some frontend has lost its
    // in-place view and its Testnet button is a navigation to a different product again.
    atUrl('cloudsforge.online')
    for (const s of SURFACES.filter(servesOwnBundle)) {
      assert.equal(viewingSurfaceUrl(s.key, 'testnet'), null, s.key)
    }
  })

  it('still answers for a surface with no bundle of its own', () => {
    // `account` is `servesUi: false`: the row reserves the hostname and says so itself — "NOTHING
    // IS SERVED HERE TODAY" — there is no `account-web` among the sibling repositories, and
    // `deploy/scripts/surface-routes.py` lists it in EXPECTED_UNROUTED for exactly that reason. So
    // it cannot view in place, and this is the honest destination for it.
    //
    // THIS USED TO BE `exchange`, WHICH IS WHY THE ANCHOR IS WORTH NAMING. The exchange was the
    // example of a hostname nothing answered until phase H shipped `micro-exchange-web`; its row
    // flipped to `servesUi: true` with a router, a compose service and a `lib/viewed.ts`, and the
    // FIRST test in this block — the regression guard over every serving surface — caught this one
    // pointing at it. That is the arrangement working: an example chosen because it was true stops
    // being true, and the test says so rather than the comment going stale.
    atUrl('cloudsforge.online')
    assert.equal(
      viewingSurfaceUrl('account', 'testnet'),
      'https://network.cloudsforge.online/?net=testnet',
    )
  })

  it('is a real destination on both estates, and never the retired hostname', () => {
    // Whatever this returns must not be a `-testnet` host, because that is the hostname the
    // combined view redirects and the redirect is what produced the original report.
    atUrl('account.cloudsforge.online', '/')
    const url = viewingSurfaceUrl('account', 'testnet')
    assert.ok(url !== null)
    assert.ok(!new URL(url).hostname.includes('-testnet'))
    assert.equal(networkFromQuery(new URL(url).search), 'testnet')
  })

  it('honours an operator override for the surface it sends to', () => {
    atUrl('cloudsforge.online')
    assert.equal(
      viewingSurfaceUrl('account', 'testnet', { network: 'https://net.example/' }),
      'https://net.example/?net=testnet',
    )
  })

  it('carries mainnet the same way, for a reader who got there on a testnet link', () => {
    atUrl('cloudsforge.online', '/', '?net=testnet')
    assert.equal(
      viewingSurfaceUrl('account', 'mainnet'),
      'https://network.cloudsforge.online/?net=mainnet',
    )
  })
})

/**
 * `createNetworkView` — the module every frontend's `src/lib/viewed.ts` is now two lines of.
 *
 * The three properties it has to keep are the estate's no-stored-network invariant, restated: the
 * default is the hostname's own network, nothing is written anywhere, and a choice re-points the
 * bundle's reads rather than moving the reader. The fourth is the one that made this a shared
 * module instead of a sixteenth copy — the self-check, which is what stops it composing a sibling
 * hostname for a deployment whose naming it does not understand.
 */
describe('createNetworkView', () => {
  it('defaults to the hostname, on both estates and off-registry', () => {
    // ── THESE SERVED THE PAGE FROM `market.<apex>`, WHICH THE REGISTRY NO LONGER KNOWS ──────────
    //
    // `market` moved to `<apex>/market` in wave 3. Its old hostname is a 301 and nothing is served
    // there, so `splitEnvLabel` can no longer read an environment out of it and this defaulted to
    // mainnet on both lines. `hub` is used instead: a surface that is STAYING on its own hostname,
    // which is what these three assertions are actually about — reading the network off the first
    // label — and a surface chosen for that reason will not move out from under them again.
    atUrl('hub.cloudsforge.online')
    assert.equal(createNetworkView().viewedNetwork(), 'mainnet')
    atUrl('hub-testnet.cloudsforge.online')
    assert.equal(createNetworkView().viewedNetwork(), 'testnet')
    atUrl('localhost')
    assert.equal(createNetworkView().viewedNetwork(), 'mainnet')
  })

  it('keeps same-network reads relative, and re-points the others', () => {
    atUrl('hub.cloudsforge.online')
    const view = createNetworkView()
    // The contract every `resolveApiBase` keeps: this estate's own reads are same-origin, and an
    // absolute same-origin URL would be a second spelling of that which drifts.
    assert.equal(view.viewedApiOrigin(), '')
    view.setViewedNetwork('testnet')
    assert.equal(view.viewedApiOrigin(), 'https://hub-testnet.cloudsforge.online')
    // Choosing the hostname's own network CLEARS the override rather than recording agreement.
    view.setViewedNetwork('mainnet')
    assert.equal(view.viewedApiOrigin(), '')
  })

  it('seeds itself from a link, once, and never writes one', () => {
    // `?net=` is the only channel that survives a cross-origin product switch without being
    // storage, and it survives the retirement redirect: `market-testnet.<apex>/x?net=testnet` 302s
    // to `market.<apex>/x?net=testnet`.
    atUrl('market.cloudsforge.online', '/listings', '?net=testnet')
    assert.equal(createNetworkView().viewedNetwork(), 'testnet')
    // Agreement is not an override: `?net=mainnet` on mainnet must leave reads relative.
    atUrl('market.cloudsforge.online', '/listings', '?net=mainnet')
    assert.equal(createNetworkView().viewedApiOrigin(), '')
    // Nonsense says nothing, rather than defaulting to either network.
    atUrl('market.cloudsforge.online', '/listings', '?net=maiinet')
    assert.equal(createNetworkView().viewedNetwork(), 'mainnet')
  })

  it('refuses a link that would point a DEV bundle at the live testnet estate', () => {
    // `NetworkSwitcher` hides itself off-registry so no CLICK can produce an override here — but a
    // link can, and a development host reads as mainnet, so `?net=testnet` would have looked like
    // a real choice.
    atUrl('localhost', '/', '?net=testnet')
    const view = createNetworkView()
    assert.equal(view.viewedNetwork(), 'mainnet')
    assert.equal(view.viewedApiOrigin(), '')
  })

  it('re-points the whole host map, and pins identity and telemetry', () => {
    // Served from `hub.<apex>` since wave 3 moved `market` to a path — see the fixture note above.
    atUrl('hub.cloudsforge.online')
    const view = createNetworkView()
    // Byte-identical until something is being viewed — which is what makes the one-word change at
    // each `apiBase()` call site safe in dev, in a preview deployment and on the apex.
    assert.deepEqual(view.viewedHosts(), cloudsforgeHosts())
    view.setViewedNetwork('testnet')
    const hosts = view.viewedHosts()
    // `market` is a PATH now, so its re-pointed address is the testnet apex plus the mount — which
    // is the property worth asserting here rather than a hostname: `viewedHosts()` re-points the
    // ORIGIN and carries the mount through untouched.
    assert.equal(hosts.market, 'https://testnet.cloudsforge.online/market')
    // And the SUBDOMAIN spelling beside it, because both have to keep working while the
    // consolidation is half done — which it will be for as long as eleven surfaces remain.
    //
    // This read `explorer` until wave 3b moved that too. `status` replaces it and will not need
    // replacing again: the plan keeps it on its own hostname permanently, so this line goes on
    // asserting the subdomain half no matter how many surfaces leave.
    assert.equal(hosts.status, 'https://status-testnet.cloudsforge.online')
    // One identity is the PREMISE of the combined view, not something it re-points per switch: the
    // reader's token was minted by the estate serving this page and is refreshed there. Telemetry
    // is about THIS bundle on THIS deployment, so filing it under testnet would make both estates'
    // error rates fiction.
    assert.equal(hosts.nimbus, cloudsforgeHosts().nimbus)
    assert.equal(hosts.lantern, cloudsforgeHosts().lantern)
    assert.equal(hosts.signin, cloudsforgeHosts().signin)
  })

  it('lets the observability surface view its own service, because there it is the subject', () => {
    // `lantern-web` IS the dashboard. Pinning `lantern` for it would mean the one bundle whose job
    // is showing telemetry could not show the other estate's.
    atUrl('lantern.cloudsforge.online')
    const view = createNetworkView({ pinned: ['nimbus', 'account', 'signin'] })
    view.setViewedNetwork('testnet')
    assert.equal(view.viewedHosts().lantern, 'https://lantern-testnet.cloudsforge.online')
    assert.equal(view.viewedHosts().nimbus, cloudsforgeHosts().nimbus)
  })

  it('does not invent a sibling for a hostname it does not understand', () => {
    // A preview deployment at `pr-42.example.dev` HAS three labels and a first label that is not an
    // environment, and `cloudsforgeHosts()` deliberately treats it as its own apex. The first
    // version of this in hub-web stripped it and produced `https://pay-testnet.example.dev`, an
    // address that resolves nowhere — a link that fails tells the reader the service is gone rather
    // than that the page is confused. The rule is CHECKED, not enumerated: compose for the network
    // the page is already on, and fall back unless that reproduces `hosts()` exactly.
    atUrl('pr-42.example.dev', '/', '?net=testnet')
    const view = createNetworkView()
    assert.deepEqual(view.viewedHosts(), cloudsforgeHosts())
    assert.equal(view.viewedSurfaceUrl('market'), cloudsforgeHosts().market)
  })

  it('composes a single label, because the wildcard certificate covers one', () => {
    // `hub` + `testnet` is `hub-testnet`, never `hub.testnet`. Cloudflare's Universal SSL is a
    // wildcard over ONE label of the apex, so the nested form fails the TLS handshake at the edge
    // before a request is ever made.
    atUrl('cloudsforge.online')
    const view = createNetworkView()
    view.setViewedNetwork('testnet')
    assert.equal(view.viewedSurfaceUrl('hub'), 'https://hub-testnet.cloudsforge.online')
    // The apex itself has no label to prefix, so the testnet site is a label of its own.
    assert.equal(view.viewedSurfaceUrl('site'), 'https://testnet.cloudsforge.online')
  })

  it('carries the basePath, so a deep link stays a deep link', () => {
    atUrl('cloudsforge.online')
    const view = createNetworkView()
    view.setViewedNetwork('testnet')
    assert.equal(view.viewedSurfaceUrl('wallet'), 'https://hub-testnet.cloudsforge.online/wallet')
  })
})

/**
 * THE RELOAD, which used to undo the switch.
 *
 *     "if we have testnet selected and we refresh the page it goes to mainnet"   — 2026-08-14
 *
 * Everything above this point passed while that was true, and could not have caught it: the choice
 * lived in module memory, every assertion here reads that same memory, and a reload is precisely
 * the event that throws it away. The address bar is the only thing a reload keeps, so these cases
 * check what is written there — and then reload for real, by building a second view at the URL the
 * first one left behind.
 *
 * `atBrowser` is `atUrl` plus the two history writers, because that is the whole mechanism.
 */
interface FakeBrowser {
  /** Everything `history` was asked to do, in order: `push:/url` and `replace:/url`. */
  writes: string[]
  /** What the address bar reads now — what a reload would be given. */
  url(): string
  /** A router navigating, exactly as react-router does it. */
  navigate(to: string): void
}

function atBrowser(url: string): FakeBrowser {
  const parsed = new URL(url)
  const writes: string[] = []
  const location = {
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
    href: parsed.href,
  }
  const apply = (kind: string, next: string): void => {
    writes.push(`${kind}:${next}`)
    const resolved = new URL(next, parsed.origin)
    location.pathname = resolved.pathname
    location.search = resolved.search
    location.hash = resolved.hash
    location.href = resolved.href
  }
  const history = {
    state: null as unknown,
    pushState(state: unknown, _title: string, next: string) {
      history.state = state
      apply('push', next)
    },
    replaceState(state: unknown, _title: string, next: string) {
      history.state = state
      apply('replace', next)
    },
  }
  g.window = { location, history, addEventListener: () => undefined }
  return {
    writes,
    url: () => `${location.pathname}${location.search}${location.hash}`,
    navigate: (to: string) => {
      // The router writes what it meant to write. It has never heard of `?net=`.
      ;(g.window as { history: typeof history }).history.pushState({ key: to }, '', to)
    },
  }
}

describe('the viewed network survives a reload', () => {
  it('is written into the address bar when the reader switches', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet')
    const view = createNetworkView()
    assert.equal(browser.writes.length, 0, 'an untouched page is not rewritten')
    view.setViewedNetwork('testnet')
    assert.equal(browser.url(), '/wallet?net=testnet')
    // In place. A switch is not a place in the reader's history, and adding one would make Back
    // mean "un-switch" on one page and "go back" everywhere else.
    assert.deepEqual(browser.writes, ['replace:/wallet?net=testnet'])
  })

  it('and F5 then reproduces what was on screen — the whole report', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet')
    createNetworkView().setViewedNetwork('testnet')
    // The reload: a brand-new bundle, with nothing but the address bar to go on.
    const reloaded = atBrowser(`https://hub.cloudsforge.online${browser.url()}`)
    const after = createNetworkView()
    assert.equal(after.viewedNetwork(), 'testnet')
    assert.equal(after.viewedApiOrigin(), 'https://hub-testnet.cloudsforge.online')
    assert.equal(reloaded.writes.length, 0, 'and it does not rewrite what it just read')
  })

  it('and switching back leaves the URL as it found it', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet')
    const view = createNetworkView()
    view.setViewedNetwork('testnet')
    view.setViewedNetwork('mainnet')
    assert.equal(browser.url(), '/wallet')
    // Not `?net=mainnet`: the parameter means "not what the hostname says", so on a mainnet page
    // its absence IS mainnet, and a reader who switches back has the URL they arrived with.
    assert.equal(createNetworkView().viewedNetwork(), 'mainnet')
  })

  it('and an in-app navigation does not quietly drop it', () => {
    // The defect one navigation later, which is the one a reader actually hits: switch, click
    // through the nav, refresh. The router composes `/mine` and has never heard of `?net=`.
    const browser = atBrowser('https://hub.cloudsforge.online/wallet')
    createNetworkView().setViewedNetwork('testnet')
    browser.navigate('/mine')
    assert.equal(browser.url(), '/mine?net=testnet')
    assert.equal(createNetworkView().viewedNetwork(), 'testnet')
    // The router's own entry is kept and then edited in place, so the history depth is the
    // router's: one push for the navigation, never two.
    assert.equal(browser.writes.filter((w) => w.startsWith('push:')).length, 1)
  })

  it('and the router keeps its state, so Back still works', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet')
    createNetworkView().setViewedNetwork('testnet')
    browser.navigate('/mine')
    // react-router stores its location key in `history.state`; replacing it with null loses the
    // scroll position and the router's place in its own stack.
    assert.deepEqual((g.window as { history: { state: unknown } }).history.state, { key: '/mine' })
  })

  it('writes nothing at all on a page nobody has switched', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet?asset=ltc')
    createNetworkView()
    assert.deepEqual(browser.writes, [])
    assert.equal(browser.url(), '/wallet?asset=ltc')
  })

  it('leaves the rest of the query and the fragment exactly as they are', () => {
    const browser = atBrowser('https://hub.cloudsforge.online/wallet?asset=ltc#send')
    createNetworkView().setViewedNetwork('testnet')
    assert.equal(browser.url(), '/wallet?asset=ltc&net=testnet#send')
  })

  it('never writes off-registry, where there is no sibling estate to name', () => {
    const browser = atBrowser('http://localhost:3000/wallet')
    const view = createNetworkView()
    // `NetworkSwitcher` hides itself here, so this cannot come from a click — but nothing should
    // put a live estate's name in a development address bar even if it could.
    view.setViewedNetwork('testnet')
    assert.deepEqual(browser.writes, [])
  })
})

/**
 * ── THE API BASE A PAGE REACHES ITS OWN SERVICE AT ──────────────────────────────────────────────
 *
 * `apiBaseFor` replaces sixteen near-identical copies of `resolveApiBase` in sixteen frontends.
 * The behaviour that matters is the SAME-ORIGIN branch, and it changed on 2026-08-19: it used to
 * answer `''` unconditionally, which is right for a surface at the root and silently wrong for one
 * at a path.
 */
describe('apiBaseFor', () => {
  const at = (origin: string, key: SurfaceKey, hosts: Record<string, string>) =>
    apiBaseFor(origin, hosts as never, key)

  it('is RELATIVE for a root-mounted surface, which is what it always was', () => {
    // The ten surfaces that have not moved must see no change at all. `market` is on its own
    // hostname today: page and service share an origin, so the request stays relative.
    assert.equal(
      at('https://market.cloudsforge.online', 'market', {
        market: 'https://market.cloudsforge.online',
      }),
      '',
    )
  })

  it('is THE MOUNT for a path-mounted surface, and `` would be the defect', () => {
    // THE ASSERTION THIS WHOLE FUNCTION EXISTS FOR. With `''` the bundle issues `/v1/titles`,
    // which resolves at the APEX ROOT — micro-site's — and micro-site answers its SPA shell. The
    // call returns 200 with an HTML body where JSON was expected: every panel in a failure state
    // and a perfectly healthy network tab.
    assert.equal(
      at('https://cloudsforge.online', 'market', { market: 'https://cloudsforge.online/market' }),
      '/market',
    )
  })

  it('is ABSOLUTE cross-origin, so `pnpm dev` reaches the service on its own port', () => {
    assert.equal(
      at('http://localhost:5173', 'market', { market: 'http://localhost:4007' }),
      'http://localhost:4007',
    )
  })

  it('is ABSOLUTE with no page origin, because a relative URL has nothing to resolve against', () => {
    assert.equal(at('', 'market', { market: 'https://cloudsforge.online/market' }),
      'https://cloudsforge.online/market')
  })

  it('leaves no trailing slash for a caller to double', () => {
    // Callers concatenate `/v1/…`. A base ending in `/` produces `/market//v1/titles`, which nginx
    // and Traefik both treat as a different path from the one that is routed.
    assert.equal(
      at('https://cloudsforge.online', 'market', { market: 'https://cloudsforge.online/market/' }),
      '/market',
    )
  })

  it('answers the whole value when it is not a URL at all, rather than throwing', () => {
    // A caller passing something unparseable gets it back unchanged: this function is on the path
    // of every request a surface makes, and a throw here is a blank page.
    assert.equal(at('https://cloudsforge.online', 'market', { market: 'not-a-url' }), 'not-a-url')
  })

  it('matches the registry for every surface that serves its own bundle', () => {
    // The property, over the real registry rather than fixtures: a page on a surface, asked for
    // its own API base, is told either the empty string or exactly its own mount — never a path
    // belonging to something else.
    const hosts = Object.fromEntries(
      SURFACES.map((s) => [s.key, `https://cloudsforge.online${s.basePath ?? ''}`]),
    )
    for (const s of SURFACES.filter(servesOwnBundle)) {
      assert.equal(
        apiBaseFor('https://cloudsforge.online', hosts as never, s.key),
        s.basePath ?? '',
        s.key,
      )
    }
  })
})

describe('apiBaseFor in development, where there is no gateway', () => {
  it('DROPS the mount for a local service, because nothing strips it there', () => {
    // ── THE ASYMMETRY DECISION 4 DID NOT HAVE, AND IT WOULD HAVE BROKEN EVERY DEV SESSION ──────
    //
    // In production a path-mounted surface reaches its API at `/market/v1/…` and Traefik strips
    // `/market` before `micro-market` sees it. Under `pnpm dev` there is no Traefik: the service
    // is a process on port 4007 serving `/v1/…` at its ROOT, and `devPort` says as much — it names
    // the thing you CALL.
    //
    // `hostsFrom` appends `basePath` to every entry, so the dev entry is
    // `http://localhost:4007/market`, and sending that would 404 every request a developer makes
    // on every path-mounted surface from wave 3 onwards.
    assert.equal(
      apiBaseFor('http://localhost:5187', { market: 'http://localhost:4007/market' } as never, 'market'),
      'http://localhost:4007',
    )
  })

  it('KEEPS the mount for the other estate, which has a gateway of its own', () => {
    // The discriminator is not "cross-origin" — viewing testnet from mainnet is cross-origin too,
    // and there the mount must stay, because the testnet gateway strips it exactly as the mainnet
    // one does. The question is whether anything is in front of the target.
    assert.equal(
      apiBaseFor(
        'https://cloudsforge.online',
        { market: 'https://testnet.cloudsforge.online/market' } as never,
        'market',
      ),
      'https://testnet.cloudsforge.online/market',
    )
  })

  it('leaves a root-mounted surface unchanged in dev, as it always was', () => {
    assert.equal(
      apiBaseFor('http://localhost:5173', { hub: 'http://localhost:4001' } as never, 'hub'),
      'http://localhost:4001',
    )
  })
})
