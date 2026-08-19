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
  servesOwnBundle,
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
  // ── ONE POSITION IS A PRODUCT DECISION AND THE OTHER FIVE ARE A MEASUREMENT ──────────────────
  //
  // `trade` is LAST because the owner asked for it there: it is the one product with nothing for a
  // visitor to do, and it carries an `incomplete` sentence saying so. Everything else in this list
  // is the answer a search gave once that position was fixed.
  //
  // The five moved because they had to. `trade`'s teal was sitting between `network`'s red and
  // `create`'s gold, which are the one pair this palette cannot separate — dE 5.6 under
  // deuteranopia — so the single-line version of "move trade to the end" closes them up and hands
  // two adjacent products indistinguishable accents. Of the 120 permutations with `trade` pinned,
  // eight clear the dE 30 gate. This is the one that leads with Forge Network, at dE 35.6.
  //
  // Foresight's blue is second rather than first for the same reason it was first before: it must
  // not touch teal or purple, which sit dE 7-8 from it under deuteranopia. Here it touches red and
  // green. See the note above PRODUCT_ACCENTS in surfaces.ts.
  'network',
  'foresight',
  'worlds',
  'market',
  'create',
  'trade',
  // ── AND ONE ENTRY THAT IS NEITHER A PRODUCT DECISION NOR THAT MEASUREMENT ────────────────────
  //
  // `exchange` joined on 2026-08-16 by the owner's report — "forge exchange is not available in the
  // product menu" — and it sits HERE, after the last product and before the first operator tool,
  // rather than anywhere in the six above. Two reasons, and the second is the one that would be
  // missed:
  //
  //   * It is `kind: 'service'`. The six above are the run the dE 30 adjacency search permuted;
  //     dropping a seventh row into the middle of them would leave that search's recorded 35.6
  //     describing an order the switcher no longer renders.
  //   * The gate that guards the run above iterates PRODUCTS, so it CANNOT see this row. A service
  //     wedged between two products would therefore change what a reader's eye compares while the
  //     guard went on measuring the pair that used to be adjacent — green, and wrong. Placed at the
  //     end, every product adjacency the search fixed is still exactly the adjacency on screen, and
  //     the two new pairs (trade|exchange, exchange|admin) were measured on their own: dE 21.2,
  //     recorded on the row.
  //
  // For a signed-out reader this is the LAST entry — `resolveProducts` drops the three `adminOnly`
  // rows below — so its only neighbour is `trade`. Both cases were swept.
  'exchange',
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
    // A HOME IS AN ADDRESS, NOT A SUBDOMAIN, AND THIS ASSERTED THE SUBDOMAIN UNTIL 2026-08-19.
    //
    // The switcher navigates to `cloudsforgeHosts()[key]`, and `hostsFrom` composes that as
    // origin + `basePath ?? ''`. So the question this test exists to ask — can a reader who picks
    // this entry get anywhere — is answered by the PAIR, and either half alone is enough to
    // answer it. `subdomain.length > 0` was an exact proxy while every switcher entry owned a
    // hostname, and the apex consolidation is what ended that: `exchange` is `subdomain: ''` with
    // `basePath: '/exchange'`, a perfectly good home that the old form called homeless.
    //
    // Both halves are checked, and the second is the one the old form could not have caught: two
    // entries resolving to the SAME address is the failure that actually strands a reader —
    // picking Forge Exchange and arriving at the marketing site — and it becomes possible for the
    // first time now that more than one surface can live on the apex.
    for (const s of SWITCHER_SURFACES) {
      assert.ok(
        s.subdomain.length > 0 || (s.basePath ?? '').length > 0,
        `${s.key} is in the switcher with neither a subdomain nor a basePath — the switcher would ` +
          `send a reader to the bare apex`,
      )
    }
    const homes = SWITCHER_SURFACES.map((s) => `${s.subdomain}|${s.basePath ?? ''}`)
    assert.equal(new Set(homes).size, homes.length, 'two switcher entries resolve to one address')
  })
})

describe('the incompleteness marker', () => {
  const marked = SURFACES.filter((s) => s.incomplete !== undefined)

  it('is only ever on a surface a person can actually open', () => {
    // The marker means "you can open this and there is nothing here". On a surface that serves no
    // page it would be a caveat about a door nobody can reach, which is noise rather than honesty.
    for (const s of marked) {
      assert.ok(s.servesUi, `${s.key} is marked incomplete and serves no page`)
    }
  })

  it('carries a sentence rather than a word', () => {
    // A bare "Coming soon" is the failure this field exists against: it is a promise with no fact
    // and no date behind it. Every marker has to say what a person cannot do.
    for (const s of marked) {
      assert.ok(s.incomplete!.length > 40, `${s.key}'s marker is too short to say anything`)
      assert.match(s.incomplete!, /\.$/, `${s.key}'s marker is not a sentence`)
      assert.doesNotMatch(s.incomplete!, /\bsoon\b/i, `${s.key}'s marker promises "soon"`)
    }
  })

  it('sorts every marked product below every unmarked one', () => {
    // Not a rule the registry invents: the owner asked for the one product with nothing to show to
    // be last. Written as an ordering INVARIANT rather than as `trade` by name, so a second
    // incomplete product cannot be quietly slotted in above five working ones.
    const flags = PRODUCTS.map((p) => p.incomplete !== undefined)
    assert.deepEqual([...flags].sort((a, b) => Number(a) - Number(b)), flags)
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
      // The only pin here whose value was chosen for a REASON rather than merely read. The three
      // above are ports their services happened to bind, and two of them collide with another
      // service's compose host port (emberkin's 4100 is identity's; aetherholm's 4120 is
      // admin-api's). 4022 is deliberately below the derived 4100+ block so that no future entry
      // in micro-org's `deployableRepos()` can grow into it — 23-tessera.md §10.1. Moving it INTO
      // that block would look like tidying and would reintroduce exactly the collision class the
      // other two entries are living examples of.
      tessera: { port: 4022, source: 'tessera/src/env.ts:55 — DEFAULT_PORT, argued at §10.1' },
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

      // ── THERE ARE TWO KINDS OF basePath ROW, AND THIS USED TO KNOW ABOUT ONE ────────────────
      //
      // It asserted `host.devPort === s.devPort`, flatly. That is true of `wallet`, `signin` and
      // `faucet` and it is true of them for a reason that does not generalise: each is a ROUTE
      // INSIDE the host's bundle. Same repository, same container, same dev server — so naming a
      // different port would name a server that does not have the route.
      //
      // `journal` is the other kind, and the apex consolidation makes it the first of fourteen
      // (`deploy/docs/apex-consolidation.md`). It is a SEPARATE bundle in a separate repository
      // that the GATEWAY mounts at a path on the apex. In production that distinction is
      // invisible — one origin, one path, exactly like the wallet. In development there is no
      // gateway, so the archive is served by its own vite server on its own port, at `/journal`
      // because its vite `base` says so.
      //
      // What the assertion was actually protecting is still protected, and it is the thing that
      // bites: a basePath row must not name SOMEBODY ELSE'S port. `journal` at 3010 would resolve
      // to `localhost:3010/journal` under `pnpm dev` — Forge Hub's dev server, answering with
      // Hub's bundle for an address that is not Hub's. Own the port or share the host's; a third
      // surface's is the defect.
      //
      // `servesOwnBundle` is the registry's own name for the second case, and this is what earns
      // it: the test below proves two surfaces share a port only by declared co-hosting, so a port
      // nobody else claims is a bundle nobody else serves. `network-view.test.ts` decides who may
      // carry `viewsAnyNetwork` on exactly that basis.
      const shared = host.devPort === s.devPort
      const own = servesOwnBundle(s)
      assert.ok(
        shared || own,
        `${s.key} names devPort ${s.devPort}, which is neither its host's (${host.devPort}) nor ` +
          `its own — under 'pnpm dev' it resolves to another surface's dev server, which answers ` +
          `with that surface's bundle rather than 404ing.`,
      )
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
    assert.ok(worst >= 30, `worst adjacent dE ${worst} — the recorded guarantee is 35.6`)
  })

  it('does not let moving a product for a product reason close up red and gold', () => {
    // The regression this suite exists for, made concrete. `trade`'s teal was between `network`'s
    // red and `create`'s gold — the one pair the palette cannot separate, dE 5.6 under
    // deuteranopia — so "move trade to the end" is a one-line edit that costs the guarantee above
    // and looks like nothing in a diff. Asserting the FLOOR alone would not have caught it as an
    // argument, only as a number, so the pair is named here.
    const order = PRODUCTS.map((p) => p.key)
    const red = order.indexOf('network')
    const gold = order.indexOf('create')
    assert.ok(Math.abs(red - gold) > 1, 'network and create are adjacent: dE 5.6 under deuteranopia')
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

  it('every product declares a LIGHT accent as well as a dark one', () => {
    /*
     * The other half of the scheme fork, and the failure it prevents is the one this file already
     * has a test for one scheme up: `[data-product='foresight']` matched nothing and the product
     * silently wore the company ember.
     *
     * `--cf-accent-light` has a fallback in the light block (`var(--cf-accent-light,
     * var(--cf-ember-light))`), which is exactly the kind of silent fallthrough that produces a
     * product wearing the wrong colour and looking fine. The fallback exists so a page with no
     * product attribute still resolves; it must never be what a declared product lands on.
     */
    for (const p of PRODUCTS) {
      const block = new RegExp(
        `\\[data-cf-product=['"]${p.key}['"]\\][^{]*\\{[^}]*--cf-accent-light:\\s*#[0-9a-f]{6}`,
        'i',
      )
      assert.match(TOKENS, block, `${p.key}'s rule declares no --cf-accent-light`)
    }
  })

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
    //
    // The token is `--cf-accent-dark`, not `--cf-accent`, since the scheme fork: the product
    // blocks declare the RAW per-scheme values and the public `--cf-accent` is mapped onto
    // whichever scheme applies, once, after every product block. The registry's `accent` field is
    // the DARK one — it is the value the switcher, the marks and every chart were validated with —
    // so this is still the same assertion about the same colour, spelled at the name that now
    // carries it. A test left matching `--cf-accent:` would have gone green again the moment
    // somebody added an unrelated `--cf-accent:` line to the file, which is why it is anchored to
    // the exact token rather than loosened.
    for (const p of PRODUCTS) {
      const block = new RegExp(
        `\\[data-cf-product=['"]${p.key}['"]\\][^{]*\\{[^}]*--cf-accent-dark:\\s*${p.accent}`,
        'i',
      )
      assert.match(TOKENS, block, `${p.key}'s rule does not set --cf-accent-dark: ${p.accent}`)
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
