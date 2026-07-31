import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
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
