/**
 * The footer, asserted on the markup React actually emits.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS AND IS NOT
 *
 * `renderToStaticMarkup` is a REAL React render of the real component — the same element tree, the
 * same hooks, the same props. It is not a DOM shim standing in for a browser and it is not
 * evidence that anything painted. That evidence is `scripts/footer-audit.ts`, which drives
 * Chromium through the estate gateway and stubs nothing; this file is the part that can be proved
 * in a checkout with no browser and no estate, and it is deliberately about STRUCTURE — which
 * links exist, where they point, who is allowed to see them.
 *
 * The estate has already shipped sixteen frontends whose suites were green while the pages were
 * unusable, because each stubbed its own network. Nothing here is allowed to be the reason anybody
 * believes the footer renders. Both tiers, or neither.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import { CloudsForgeFooter, FOOTER_LEGAL_LINKS, cloudsforgeHosts } from './index.tsx'
import { FOOTER_GROUPS, FOOTER_SURFACES, PRODUCTS, SURFACES, surface } from './surfaces.ts'
import type { AccountState } from './index.tsx'
import type { SurfaceKey } from './surfaces.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

function render(current: SurfaceKey, account?: AccountState): string {
  return renderToStaticMarkup(createElement(CloudsForgeFooter, { current, ...(account ? { account } : {}) }))
}

/** Every `<a href="…">text</a>` in a rendered footer, in document order. */
function anchors(html: string): { href: string; text: string; current: boolean }[] {
  const out: { href: string; text: string; current: boolean }[] = []
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = m[1] ?? ''
    const href = /href="([^"]*)"/.exec(attrs)?.[1] ?? ''
    out.push({
      href,
      text: (m[2] ?? '').replace(/<[^>]*>/g, '').replace(/&#x27;|&amp;/g, "'").trim(),
      current: attrs.includes('aria-current="page"'),
    })
  }
  return out
}

const SIGNED_OUT = render('trade')
const OPERATOR = render('admin', { signedIn: true, handle: 'op', roles: ['admin'] })

/* ═════════════════════════════════════ the landmark ══════════════════════════════════════ */

describe('the footer is a landmark', () => {
  it('renders exactly one contentinfo, named', () => {
    const opens = [...SIGNED_OUT.matchAll(/<footer\b/g)]
    assert.equal(opens.length, 1, `${opens.length} <footer> elements`)
    assert.match(SIGNED_OUT, /<footer class="cf-foot" role="contentinfo" aria-label="CloudsForge">/)
  })

  it('states role="contentinfo" rather than relying on the implicit one', () => {
    /*
     * The implicit role of <footer> is contentinfo ONLY while it is not inside a sectioning
     * element, and whether it is, is a property of each consumer's shell rather than of this
     * package. Nineteen shells, any of which may one day wrap its outlet in a <section>; the
     * explicit role is what stops that silently demoting the landmark the browser guard looks for.
     */
    assert.ok(SIGNED_OUT.includes('role="contentinfo"'))
  })

  it('labels every column nav by its own visible heading', () => {
    const navs = [...SIGNED_OUT.matchAll(/<nav class="cf-foot__col" aria-labelledby="([^"]+)"/g)]
    assert.ok(navs.length >= 4, `only ${navs.length} labelled navigation columns`)
    for (const nav of navs) {
      const id = nav[1] ?? ''
      assert.ok(
        SIGNED_OUT.includes(`<h2 class="cf-foot__title" id="${id}">`),
        `nav labelled by "${id}", and no heading carries that id — an unlabelled landmark`,
      )
    }
  })

  it('uses h2, so no heading level is skipped under a page h1', () => {
    assert.ok(SIGNED_OUT.includes('<h2 class="cf-foot__title"'))
    assert.ok(!/<h[3-6][ >]/.test(SIGNED_OUT), 'the footer skips a heading level')
  })
})

/* ═══════════════════════════════ derived, not written down ═══════════════════════════════ */

describe('every navigation link is derived from the registry', () => {
  it('offers exactly the registry surfaces plus the two declared legal routes — no more', () => {
    /*
     * THE COUNTING TEST, and the one that makes every other assertion in this file worth having.
     * A link typed into the component by hand would not break "the products are present" or "admin
     * is hidden"; it would break exactly this. The expected number is computed from the registry,
     * so it moves when the registry moves and never when somebody edits the JSX.
     */
    const expected = FOOTER_SURFACES.filter((s) => !s.adminOnly).length + FOOTER_LEGAL_LINKS.length
    assert.equal(anchors(SIGNED_OUT).length, expected)
  })

  it('names each surface with its registry name and its resolved host', () => {
    const hosts = cloudsforgeHosts()
    const byHref = new Map(anchors(SIGNED_OUT).map((a) => [a.href, a.text]))
    for (const s of FOOTER_SURFACES) {
      if (s.adminOnly) continue
      assert.equal(byHref.get(hosts[s.key]), s.name, `${s.key} is not offered at ${hosts[s.key]}`)
    }
  })

  it('carries all six products', () => {
    const text = anchors(SIGNED_OUT).map((a) => a.text)
    for (const p of PRODUCTS) assert.ok(text.includes(p.name), `${p.name} is missing`)
  })

  it('reaches the developer platform, which the registry says is reached from here', () => {
    /*
     * `surfaces.ts`, the `developers` row: "Reached from the footer, not the product switcher."
     * That sentence was true of nothing — nine surfaces had no footer at all and the seven that
     * did were bespoke. It is the single claim this whole component was written to make true, so
     * it is asserted by name rather than left to the sweep above.
     */
    const dev = anchors(SIGNED_OUT).find((a) => a.text === surface('developers').name)
    assert.ok(dev, 'the developer platform is not reachable from the footer')
    assert.equal(dev.href, cloudsforgeHosts().developers)
  })

  it('holds no surface name as a literal in the component source', () => {
    /*
     * The anti-copy guard. Everything above would still pass if the JSX listed the six products by
     * hand and happened to agree with the registry today — which is exactly the state the estate
     * was in with `obs.ts` (sixteen identical copies) and the gateway hostnames (fifteen).
     */
    const src = readFileSync(join(HERE, 'index.tsx'), 'utf8')
    const footer = src.slice(src.indexOf('export function CloudsForgeFooter'))
    assert.ok(footer.length > 500, 'the footer component was not found in index.tsx')
    for (const s of SURFACES) {
      assert.ok(
        !footer.includes(`'${s.name}'`) && !footer.includes(`>${s.name}<`),
        `"${s.name}" is written into the footer's JSX instead of read from the registry`,
      )
    }
  })

  it('partitions FOOTER_SURFACES across the columns exactly once each', () => {
    // A fourth SurfaceKind added without a column would silently drop every surface wearing it.
    const placed = FOOTER_GROUPS.flatMap((g) => g.surfaces.map((s) => s.key))
    assert.equal(placed.length, new Set(placed).size, 'a surface appears in two columns')
    assert.deepEqual([...placed].sort(), FOOTER_SURFACES.map((s) => s.key).sort())
  })
})

/* ═════════════════════════ what must never be offered ════════════════════════════ */

describe('the footer never offers an address that does not answer', () => {
  it('omits every surface the registry marks as serving no page', () => {
    const hosts = cloudsforgeHosts()
    const hrefs = anchors(OPERATOR).map((a) => a.href)
    const dead = SURFACES.filter((s) => !s.servesUi)
    assert.ok(dead.length >= 6, 'the registry claims every surface serves a page — check servesUi')
    for (const s of dead) {
      assert.ok(!hrefs.includes(hosts[s.key]), `${s.key} serves no page and is linked anyway`)
      assert.ok(
        !anchors(OPERATOR).some((a) => a.text === s.name),
        `${s.key} serves no page and is named anyway`,
      )
    }
  })

  it('omits beacon and lantern even though the switcher offers them', () => {
    /*
     * Named, because it is the counter-intuitive case and a future reader will otherwise "fix" it.
     * Both are `inSwitcher: true`, both answer 404 on their own hostname (measured through the
     * gateway — see the `servesUi` note in surfaces.ts). The switcher's entries are a pre-existing
     * defect this change does not touch; the footer simply does not repeat it.
     */
    for (const key of ['beacon', 'lantern'] as const) {
      assert.equal(surface(key).inSwitcher, true, `${key} is no longer in the switcher`)
      assert.equal(surface(key).servesUi, false, `${key} now serves a page — offer it`)
      assert.ok(!anchors(OPERATOR).some((a) => a.text === surface(key).name))
    }
  })

  it('omits the sign-in surface, which the account menu owns', () => {
    assert.equal(surface('signin').servesUi, true, 'signin no longer serves a page')
    assert.ok(!anchors(OPERATOR).some((a) => a.href === cloudsforgeHosts().signin))
  })
})

/* ═════════════════════════════════ adminOnly ═════════════════════════════════════ */

describe('adminOnly, for a signed-out visitor', () => {
  const adminSurfaces = SURFACES.filter((s) => s.adminOnly && s.servesUi)

  it('has operator surfaces to hide in the first place', () => {
    // Without this the two assertions below would be loops over nothing that read as guarantees.
    assert.ok(adminSurfaces.length >= 2, `only ${adminSurfaces.length} adminOnly surfaces serve a page`)
  })

  it('shows none of them to a visitor with no account at all', () => {
    for (const s of adminSurfaces) {
      assert.ok(!SIGNED_OUT.includes(s.name), `${s.key} is advertised to a signed-out reader`)
    }
  })

  it('shows none of them to a signed-in reader who is not an operator', () => {
    const player = render('trade', { signedIn: true, handle: 'player', roles: ['user'] })
    for (const s of adminSurfaces) assert.ok(!player.includes(s.name), `${s.key} is shown to a player`)
  })

  it('shows them to an operator', () => {
    for (const s of adminSurfaces) {
      assert.ok(OPERATOR.includes(s.name), `${s.key} is hidden from an operator`)
    }
  })

  it('defaults to hidden when an app passes no account, rather than to shown', () => {
    // The failure mode worth pinning: an app that forgets the prop must fail SAFE.
    assert.deepEqual(
      anchors(render('trade')).map((a) => a.href),
      anchors(render('trade', { signedIn: false })).map((a) => a.href),
    )
  })
})

/* ═══════════════════════════════ link text ══════════════════════════════════════ */

describe('the link text is usable out of context', () => {
  it('never says click here, read more, or here', () => {
    for (const a of anchors(OPERATOR)) {
      assert.doesNotMatch(a.text, /^(click here|here|read more|more|link|this)$/i, a.href)
      assert.ok(a.text.length >= 4, `link text "${a.text}" is too short to mean anything`)
    }
  })

  it('gives every anchor a real destination', () => {
    for (const a of anchors(OPERATOR)) {
      assert.ok(a.href.length > 0 && a.href !== '#', `"${a.text}" has no destination`)
      assert.match(a.href, /^https?:\/\//, `"${a.text}" points at ${a.href}`)
    }
  })

  it('marks the surface you are standing on, exactly once', () => {
    const marked = anchors(render('market')).filter((a) => a.current)
    assert.equal(marked.length, 1)
    assert.equal(marked[0]?.text, surface('market').name)
  })

  it('marks nothing when the surface is not one of its own entries', () => {
    // `signin` is excluded from the list, so a footer rendered on it marks nothing — and must not
    // mark something else instead.
    assert.equal(anchors(render('signin')).filter((a) => a.current).length, 0)
  })
})

/* ══════════════════════ the two links that are not surfaces ══════════════════════ */

describe('the legal links are declared as non-surfaces and resolve on the site host', () => {
  it('resolves both against the marketing site rather than the current origin', () => {
    const site = cloudsforgeHosts().site
    for (const l of FOOTER_LEGAL_LINKS) {
      const found = anchors(SIGNED_OUT).find((a) => a.text === l.label)
      assert.ok(found, `${l.label} is missing`)
      assert.equal(found.href, `${site}${l.path}`)
    }
  })

  it('names no path that the marketing site does not route', () => {
    /*
     * The one place in this footer where drift is possible: `@cloudsforge/ui` cannot import from a
     * consumer, so these four strings are a restatement of `site/src/lib/routes.ts`. When a
     * checkout of `micro-site` is beside this one, the restatement is checked against it.
     *
     * It does NOT skip when the checkout is absent — the assertion above still runs, and this one
     * asserts the two paths are at least well-formed, because "not run" reading as "passed" is the
     * defect this estate keeps paying for.
     */
    for (const l of FOOTER_LEGAL_LINKS) assert.match(l.path, /^\/[a-z-]+$/)

    const routes = join(HERE, '../../../../site/src/lib/routes.ts')
    if (!existsSync(routes)) return
    const src = readFileSync(routes, 'utf8')
    for (const l of FOOTER_LEGAL_LINKS) {
      assert.ok(
        src.includes(`path: '${l.path.slice(1)}'`),
        `micro-site no longer routes ${l.path} — the footer links a 404 from every surface`,
      )
      assert.ok(
        src.includes(`summary: '${l.label} —`),
        `micro-site renamed ${l.path}; the footer still calls it "${l.label}"`,
      )
    }
  })
})

/* ═════════════════════════════════ the note slot ═════════════════════════════════ */

describe('the surface-specific closing sentence', () => {
  it('renders when given, in the landmark', () => {
    const html = renderToStaticMarkup(
      createElement(CloudsForgeFooter, { current: 'foresight', note: 'Stakes go to the contract.' }),
    )
    assert.match(html, /<p class="cf-foot__note">Stakes go to the contract\.<\/p>/)
  })

  it('renders no empty paragraph when omitted', () => {
    assert.ok(!SIGNED_OUT.includes('cf-foot__note'))
  })

  it('closes with the standing surface, from the registry', () => {
    const here = surface('trade')
    assert.ok(SIGNED_OUT.includes(`${here.name} — ${here.blurb}`))
  })
})
