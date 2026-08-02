import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  CLOUDSFORGE_EMBER,
  KNOWN_SUBS,
  PRODUCTS,
  PRODUCT_ACCENTS,
  RETIRED_ACCENTS,
  SURFACES,
  SWITCHER_SURFACES,
  surface,
  type SurfaceKey,
} from './surfaces.ts'

/**
 * The order is restated here as a literal rather than imported, deliberately.
 *
 * A test that reads the order out of the file it is testing asserts only that the file equals
 * itself. This literal is a second, independent copy of design-system.md section 3, so reordering
 * the registry for narrative reasons fails here and has to be argued with the specification.
 */
const DOCUMENTED_SWITCHER_ORDER: readonly SurfaceKey[] = [
  // Foresight is FIRST, and that is a measured position rather than a product-story one: it is the
  // only slot where its blue is not adjacent to trade's teal or market's purple, which under
  // deuteranopia sit dE 7-8 away from it. Beside network's red it clears dE 50. See the note above
  // PRODUCT_ACCENTS in surfaces.ts.
  'foresight',
  'network',
  'trade',
  'create',
  'market',
  'worlds',
  'admin',
  'lantern',
  'beacon',
]

describe('the switcher', () => {
  it('lists the products in the validated separation order, then the operator tools', () => {
    assert.deepEqual(
      SWITCHER_SURFACES.map((s) => s.key),
      DOCUMENTED_SWITCHER_ORDER,
    )
  })

  it('puts every operator tool after every product, so their accents are never adjacent', () => {
    const firstAdmin = SWITCHER_SURFACES.findIndex((s) => s.adminOnly === true)
    const lastProduct = SWITCHER_SURFACES.map((s) => s.kind === 'product').lastIndexOf(true)
    assert.ok(firstAdmin > lastProduct)
  })

  it('gives every entry the three non-colour channels: a glyph, a name and a blurb', () => {
    for (const s of SWITCHER_SURFACES) {
      assert.ok(s.glyph.length > 0, `${s.key} has no glyph`)
      assert.ok(s.name.length > 0, `${s.key} has no name`)
      assert.ok(s.blurb.length > 0, `${s.key} has no blurb`)
      assert.match(s.accent, /^#[0-9a-f]{6}$/, `${s.key} has no six-digit lowercase accent`)
    }
  })

  it('gives every entry a distinct accent', () => {
    const accents = SWITCHER_SURFACES.map((s) => s.accent)
    assert.equal(new Set(accents).size, accents.length)
  })

  it('holds no surface that is in the switcher and has no home', () => {
    for (const s of SWITCHER_SURFACES) {
      assert.ok(s.subdomain.length > 0, `${s.key} is in the switcher with no subdomain`)
    }
  })
})

describe('the accent guard', () => {
  /**
   * This is the test that stops a sixth orange.
   *
   * The palette this registry replaced shipped six accents of which five were orange; the worst
   * pair measured dE 4.1 under normal vision and dE 1.3 under protanopia, which is to say the
   * switcher was distinguishing six products by a channel that distinguishes two. Nothing about
   * adding a hex by hand feels like a mistake at the time, so the guard is here rather than in a
   * review checklist.
   */
  it('allows a product only one of the five validated accents', () => {
    for (const p of PRODUCTS) {
      assert.ok(
        (PRODUCT_ACCENTS as readonly string[]).includes(p.accent),
        `${p.key} wears ${p.accent}, which is not one of the five validated product accents`,
      )
    }
  })

  it('uses each of the five exactly once', () => {
    assert.deepEqual(
      PRODUCTS.map((p) => p.accent),
      [...PRODUCT_ACCENTS],
    )
  })

  it('never lets ember be a product accent — it is company chrome', () => {
    for (const p of PRODUCTS) {
      assert.notEqual(p.accent, CLOUDSFORGE_EMBER, `${p.key} is wearing the company colour`)
    }
    assert.ok(!(PRODUCT_ACCENTS as readonly string[]).includes(CLOUDSFORGE_EMBER))
  })

  it('holds no retired accent anywhere in the registry', () => {
    for (const s of SURFACES) {
      assert.ok(
        !(RETIRED_ACCENTS as readonly string[]).includes(s.accent),
        `${s.key} has resurrected the retired accent ${s.accent}`,
      )
    }
  })

  it('gives admin, lantern, beacon and developers an explicit accent of their own', () => {
    // Admin used to set data-cf-product="admin" against a selector that did not exist and fell
    // through to the ember default in silence. An explicit value is the fix; this asserts it.
    const explicit = ['admin', 'lantern', 'beacon', 'developers'] as const
    for (const key of explicit) {
      const s = surface(key)
      assert.notEqual(s.accent, CLOUDSFORGE_EMBER, `${key} is still falling through to ember`)
      assert.match(s.accent, /^#[0-9a-f]{6}$/)
    }
  })
})

describe('the registry', () => {
  it('has six products and no more', () => {
    // The count is asserted so that adding a product is a deliberate act that updates this file,
    // not something that happens by editing an array. Forge Foresight was the sixth.
    assert.equal(PRODUCTS.length, 6)
  })

  it('keeps the marketing site and Forge Hub out of the switcher', () => {
    // The logo already links to the site, and Hub is the container the user is inside.
    assert.equal(surface('site').inSwitcher, false)
    assert.equal(surface('hub').inSwitcher, false)
  })

  it('keeps the developer platform out of the switcher too', () => {
    assert.equal(surface('developers').inSwitcher, false)
  })

  it('holds unique keys', () => {
    const keys = SURFACES.map((s) => s.key)
    assert.equal(new Set(keys).size, keys.length)
  })

  it('gives every product a brand mark, and never reuses one', () => {
    const marks = SURFACES.map((s) => s.markId).filter((m): m is string => m !== null)
    assert.equal(new Set(marks).size, marks.length)
    for (const p of PRODUCTS) assert.ok(p.markId, `${p.key} has no mark`)
  })

  it('only marks a service adminOnly, never a product', () => {
    for (const s of SURFACES) {
      if (s.adminOnly) assert.notEqual(s.kind, 'product', `${s.key} is an adminOnly product`)
    }
  })

  it('states a usable dev port for every surface', () => {
    for (const s of SURFACES) {
      assert.ok(Number.isInteger(s.devPort) && s.devPort > 1024 && s.devPort < 65536, s.key)
    }
  })

  /**
   * A devPort is a FACT ABOUT A SERVICE, not an allocation — and three of them have been wrong.
   *
   * `foresight` carried beacon's 4011; `emberkin` carried 3014 while binding 4100; `admin` carried
   * 3002 while `admin-api` binds 4014. The uniqueness check below cannot catch any of these,
   * because a wrong port that collides with nothing is indistinguishable from a right one. Only
   * comparing against the service settles it.
   *
   * This package cannot import another repository's `env.ts`, so the verified value is pinned here
   * WITH the line it was read from. That makes the pin falsifiable: changing the registry without
   * changing the service fails, and moving the service means updating a citation somebody can
   * check rather than a number nobody can.
   *
   * Only surfaces whose service binds a DISTINCTIVE port are listed. Most services default to
   * `PORT 4000` (the service-template default) and are separated by compose, so for those the
   * registry port really is an allocation and pinning it here would assert something untrue.
   */
  it('agrees with the port each service actually binds', () => {
    const BOUND: Record<string, { port: number; source: string }> = {
      admin: { port: 4014, source: 'admin-api/src/env.ts:167' },
      lantern: { port: 4010, source: 'lantern/src/env.ts' },
      beacon: { port: 4011, source: 'beacon/src/env.ts' },
      foresight: { port: 4021, source: 'foresight/src/env.ts' },
      emberkin: { port: 4100, source: 'emberkin/src/env.ts' },
      aetherholm: { port: 4120, source: 'aetherholm/src/env.ts:105' },
      explorer: { port: 4008, source: 'indexer/src/env.ts:295 — the chain index this surface reads' },
      keyvault: { port: 4005, source: 'custody/src/env.ts:188 — custody, which this entry names' },
    }
    for (const [key, { port, source }] of Object.entries(BOUND)) {
      const s = SURFACES.find((o) => o.key === key)
      if (!s) throw new Error(`${key} is pinned to a port but is not in the registry`)
      assert.equal(
        s.devPort,
        port,
        `${key} says devPort ${s.devPort}, but the service binds ${port} (${source}). ` +
          `Under 'pnpm dev' the registry value is the one a frontend calls, so a wrong one ` +
          `resolves to a port nothing listens on.`,
      )
    }
  })

  it('gives a basePath surface a rooted path on a host that exists', () => {
    for (const s of SURFACES) {
      if (s.basePath === undefined) continue
      assert.ok(s.basePath.startsWith('/'), `${s.key} basePath is not rooted`)
      // The host it rides on must be a real surface, otherwise the path resolves to an address
      // with nothing on it — which is precisely what the old wallet entry did.
      const host = SURFACES.find(
        (o) => o.key !== s.key && o.subdomain === s.subdomain && o.basePath === undefined,
      )
      if (!host) throw new Error(`${s.key} rides on a host that is not in the registry`)
      assert.equal(host.devPort, s.devPort, `${s.key} disagrees with its host about the port`)
    }
  })

  it('throws on an unknown key rather than resolving it to a URL', () => {
    assert.throws(() => surface('nope' as SurfaceKey), /Unknown CloudsForge surface: nope/)
  })
})

describe('KNOWN_SUBS', () => {
  it('collects every declared subdomain plus www, and never the empty apex', () => {
    assert.ok(KNOWN_SUBS.has('hub'))
    assert.ok(KNOWN_SUBS.has('trade'))
    assert.ok(KNOWN_SUBS.has('www'))
    assert.ok(!KNOWN_SUBS.has(''))
  })
})

describe('the palette is measured, not asserted', () => {
  // The design system used to record dE figures beside a "Reproduce:" line pointing at a script
  // that had never existed, so the numbers could not be checked and were wrong in both directions:
  // adjacent separation was far better than claimed, all-pairs far worse. These tests run the real
  // validator, so the claim and the measurement cannot drift apart again.
  const run = (csv: string) =>
    execFileSync(
      process.execPath,
      [fileURLToPath(new URL('../../../scripts/validate_palette.mjs', import.meta.url)), csv],
      { encoding: 'utf8' },
    )

  it('the validator the comments point at actually exists and runs', () => {
    assert.match(run(PRODUCT_ACCENTS.join(',')), /worst ADJACENT/)
  })

  it('every accent in the registry is one of the validated set', () => {
    for (const p of PRODUCTS) {
      assert.ok(
        (PRODUCT_ACCENTS as readonly string[]).includes(p.accent),
        `${p.key} wears ${p.accent}, which is not a validated accent`,
      )
    }
  })

  it('no retired accent has crept back in', () => {
    for (const p of PRODUCTS) {
      assert.ok(!(RETIRED_ACCENTS as readonly string[]).includes(p.accent))
    }
  })

  it('adjacent separation in switcher order clears the gate', () => {
    // The honest gate: the switcher is a vertical list, so only neighbours ever touch. This is the
    // property that must not regress when a product is added or the order is changed for a
    // narrative reason.
    const out = run(PRODUCTS.map((p) => p.accent).join(','))
    const worst = Number(/worst ADJACENT : dE ([\d.]+)/.exec(out)?.[1])
    assert.ok(worst >= 30, `worst adjacent dE ${worst} — the recorded guarantee is 36.1`)
  })

  it('records the all-pairs weakness rather than pretending it is not there', () => {
    // Red and gold are dE 5.6 apart under deuteranopia. They are never adjacent, which is why this
    // is a documented trade — but a test that quietly passed would let someone put them in one
    // legend. If this ever IMPROVES, update the number; it is a floor, not a target.
    const out = run(PRODUCTS.map((p) => p.accent).join(','))
    const worst = Number(/worst ALL-PAIRS: dE ([\d.]+)/.exec(out)?.[1])
    assert.ok(worst < 10, 'if all-pairs separation is now good, this comment and tokens.css are stale')
  })
})

describe('the registry and the stylesheet agree', () => {
  // Both tests below exist because both defects shipped in one commit, were invisible to 75 green
  // tests, and were found by the first application to consume the new product — micro-foresight-web.
  // A registry entry that no stylesheet rule matches, and a port that resolves to another service,
  // are exactly the failures a type checker cannot see.
  const TOKENS = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8')

  it('every product has an accent rule, spelled data-cf-product', () => {
    // Foresight was added as `[data-product='foresight']` — missing the `cf-` prefix every other
    // product carries. The rule matched nothing, so the accent silently fell back to the company
    // ember: the product looked fine and wore the wrong colour.
    for (const p of PRODUCTS) {
      assert.match(
        TOKENS,
        new RegExp(`\\[data-cf-product=['"]${p.key}['"]\\]`),
        `${p.key} has no [data-cf-product='${p.key}'] rule in tokens.css`,
      )
    }
    assert.doesNotMatch(
      TOKENS,
      /\[data-product=/,
      'an unprefixed [data-product=...] selector matches nothing in this design system',
    )
  })

  it('every product accent rule declares the hue the registry records', () => {
    // The rule existing is not enough — it has to carry the same value, or the registry and the
    // stylesheet disagree about what colour a product is.
    for (const p of PRODUCTS) {
      const block = new RegExp(
        `\\[data-cf-product=['"]${p.key}['"]\\][^{]*\\{[^}]*--cf-accent:\\s*${p.accent}`,
        'i',
      )
      assert.match(TOKENS, block, `${p.key}'s rule does not set --cf-accent: ${p.accent}`)
    }
  })

  it('no two unrelated surfaces claim the same dev port', () => {
    // Three collisions are deliberate: a sub-surface served by its parent's dev server. Anything
    // else means one surface's local URL resolves to another service — foresight briefly shared
    // beacon's 4011, so a local Forge Foresight was the monitoring stack.
    // Keys are compared sorted, so these are written sorted too.
    // `hub+signin+wallet`: Forge Hub serves the wallet page AND, since docs/ecosystem/22 §8.1, the
    // sign-in surface — the estate has no other bundle that could, and every product's `Sign in`
    // button led to an address nothing answered until it did.
    const CO_HOSTED = new Set(['faucet+network', 'hub+signin+wallet', 'account+nimbus'])
    const byPort = new Map<number, string[]>()
    for (const s of SURFACES) {
      const list = byPort.get(s.devPort) ?? []
      list.push(String(s.key))
      byPort.set(s.devPort, list)
    }
    for (const [port, keys] of byPort) {
      if (keys.length < 2) continue
      const pair = keys.sort().join('+')
      assert.ok(
        CO_HOSTED.has(pair),
        `port ${port} is claimed by ${pair}; if that is deliberate co-hosting, say so in CO_HOSTED`,
      )
    }
  })
})
