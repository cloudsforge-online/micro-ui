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
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import {
  CloudsForgeFooter,
  FOOTER_LEGAL_LINKS,
  FOOTER_SOCIAL_LINKS,
  cloudsforgeHosts,
} from './index.tsx'
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
  it('offers exactly the registry surfaces plus the three declared legal routes — no more', () => {
    /*
     * THE COUNTING TEST, and the one that makes every other assertion in this file worth having.
     * A link typed into the component by hand would not break "the products are present" or "admin
     * is hidden"; it would break exactly this. The expected number is computed from the registry,
     * so it moves when the registry moves and never when somebody edits the JSX.
     */
    const expected =
      FOOTER_SURFACES.filter((s) => !s.adminOnly).length +
      FOOTER_LEGAL_LINKS.length +
      FOOTER_SOCIAL_LINKS.length
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

  it('offers beacon and lantern to an operator, now that both answer', () => {
    /*
     * ── THIS TEST USED TO ASSERT THE OPPOSITE, AND THE INVERSION IS THE RECORD ────────────────
     *
     * It was called "omits beacon and lantern even though the switcher offers them", and it
     * pinned `servesUi: false` on both with the message "now serves a page — offer it". That was
     * correct while it was true: the switcher offered two entries that answered
     * `404 application/json`, and the footer declined to repeat a defect it could not fix.
     *
     * **It is no longer true.** `micro-lantern-web` and `micro-beacon-web` are deployed and routed
     * beside their services, both hostnames were measured at `200 text/html` through the gateway
     * with `--cacert` and no `-k`, and `servesUi` was flipped on that measurement — the evidence
     * is quoted beside each row in surfaces.ts. So the test is INVERTED rather than deleted: the
     * claim it makes is now the stronger one, that the footer offers exactly what answers.
     *
     * That this file went red on the flip is the mechanism working. An earlier attempt set the
     * flag before the routers existed and was stopped here, which is the whole reason this pairing
     * is worth keeping pinned in both directions rather than loosened to "whatever the registry
     * says".
     *
     * Both are `adminOnly`, so the audience assertions below are what make "offered" safe: an
     * operator sees them, a player and a signed-out reader do not. Those live in the `adminOnly`
     * suite at the foot of this file and pick these two up automatically, because that suite
     * filters on `adminOnly && servesUi`.
     */
    for (const key of ['beacon', 'lantern'] as const) {
      const s = surface(key)
      assert.equal(s.inSwitcher, true, `${key} is no longer in the switcher`)
      assert.equal(
        s.servesUi,
        true,
        `${key} no longer serves a page. If its bundle or its gateway router has been withdrawn, ` +
          'this test inverts back — but only on a measurement, never on a reading of the registry.',
      )
      assert.ok(
        FOOTER_SURFACES.some((f) => f.key === key),
        `${key} serves a page and is not in FOOTER_SURFACES`,
      )
      const shown = anchors(OPERATOR)
      assert.ok(
        shown.some((a) => a.text === s.name && a.href === cloudsforgeHosts()[key]),
        `${key} answers on its own hostname and the operator footer does not link it`,
      )
      // The other half, and the one a bare "is it listed" check would miss: these are operator
      // tools, so a reader with no account must not be told they exist at all.
      assert.ok(
        !anchors(SIGNED_OUT).some((a) => a.text === s.name),
        `${key} is an adminOnly console and is advertised to a signed-out reader`,
      )
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

/* ═════════════════════ the three links that are not surfaces ═════════════════════ */

describe('the legal links are declared as non-surfaces and resolve on the site host', () => {
  it('resolves each against the marketing site rather than the current origin', () => {
    const site = cloudsforgeHosts().site
    for (const l of FOOTER_LEGAL_LINKS) {
      const found = anchors(SIGNED_OUT).find((a) => a.text === l.label)
      assert.ok(found, `${l.label} is missing`)
      assert.equal(found.href, `${site}${l.path}`)
    }
  })

  it('names no path that the marketing site does not route, and calls it what the site calls it', async () => {
    /*
     * The one place in this footer where drift is possible: `@cloudsforge/ui` cannot import from a
     * consumer, so these six strings are a restatement of `site/src/lib/routes.ts`. When a
     * checkout of `micro-site` is beside this one, the restatement is checked against it.
     *
     * It does NOT skip when the checkout is absent — the assertion above still runs, and this one
     * asserts the paths are at least well-formed, because "not run" reading as "passed" is the
     * defect this estate keeps paying for.
     *
     * ── WHY THIS EXECUTES THE ROUTE TABLE RATHER THAN SCANNING ITS SOURCE TEXT ────────────────
     *
     * It used to `readFileSync` that file and look for the literal `summary: 'Terms of service —`.
     * **That assertion was red on `main` while both sides were correct.** micro-site lengthened the
     * terms summary (`a88c8d9`), Prettier wrapped the value onto its own line, and a scan for
     * `summary: '` immediately followed by the label stopped matching across the newline. It failed
     * saying "micro-site renamed /terms" about a file that had renamed nothing, on every run, for
     * everyone — and a check that is red on unchanged code is one people learn to scroll past, which
     * costs more than the label it guards.
     *
     * So the coupling is asserted against the DATA now. `src/lib/routes.ts` imports nothing, and
     * says in its own header that this is deliberate "so the test that reads it does not have to
     * boot a browser to find out what the routes are" — so it is simply executed. A reformatting
     * cannot fail this; a rename still does, in either direction.
     */
    for (const l of FOOTER_LEGAL_LINKS) assert.match(l.path, /^\/[a-z-]+$/)

    const routes = join(HERE, '../../../../site/src/lib/routes.ts')
    /*
     * OPTIONAL IN A CLONE, MANDATORY IN CI. `git clone micro-ui && pnpm test` must work — this is
     * a publishable library and requiring a checkout of one of its CONSUMERS to run its own suite
     * would invert the dependency. But "the input was absent, so it passed" is the exact shape of
     * gate this estate keeps finding switched off in its own pipelines, and this assertion sat in
     * that state on every CI run until `.github/workflows/ci.yml` was given the sibling checkout.
     *
     * So the skip is allowed exactly where a human can see it and not where a green tick stands in
     * for a check. If CI stops providing micro-site, this fails and says so.
     */
    if (!existsSync(routes)) {
      assert.ok(
        !process.env['CI'],
        `micro-site is not checked out beside this repository, so the footer's legal links were ` +
          `not checked against the routes they name. CI must check it out — see the sibling ` +
          `checkout step in .github/workflows/ci.yml.`,
      )
      return
    }
    const site = (await import(pathToFileURL(routes).href)) as {
      ROUTES: readonly { path: string; summary: string }[]
      LEGAL_PATHS: readonly string[]
    }

    for (const l of FOOTER_LEGAL_LINKS) {
      const route = site.ROUTES.find((r) => r.path === l.path.slice(1))
      assert.ok(
        route,
        `micro-site no longer routes ${l.path} — the footer links a 404 from every surface`,
      )
      /*
       * A legal route carries no nav `label` — that is what keeps it out of the header — so the
       * site's own footer takes its link text from the clause of the summary before the em dash
       * (`site/src/components/shell.tsx`). That clause IS the site's name for the page, so it
       * is the thing this label has to agree with: one page must not be "Terms of service" on
       * sixteen surfaces and something else on the surface that serves it.
       */
      assert.equal(
        route.summary.split(' — ')[0],
        l.label,
        `micro-site renamed ${l.path}; the footer still calls it "${l.label}"`,
      )
    }

    /*
     * The other direction, which the source scan could not see at all. This footer is the only one
     * fifteen surfaces have, so a legal page ADDED to the site is a page nothing outside the site
     * links — the same defect as a dead link, pointing the other way.
     */
    assert.deepEqual(
      FOOTER_LEGAL_LINKS.map((l) => l.path.slice(1)).sort(),
      [...site.LEGAL_PATHS].sort(),
      'micro-site and the shared footer disagree about which pages are the legal ones',
    )
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

/* ═════════════════════════════════ the social accounts ═════════════════════════════════ */

describe('the social links (micro-org#483)', () => {
  it('offers the GitHub organisation and X, at the addresses the issue names', () => {
    const byHref = new Map(anchors(SIGNED_OUT).map((a) => [a.href, a.text]))
    assert.ok(byHref.has('https://github.com/cloudsforge-online'), 'the GitHub organisation is missing')
    assert.ok(byHref.has('https://x.com/cloudsforge'), 'the X account is missing')
  })

  it('gives each icon link an accessible name as real text, not an aria-label', () => {
    /*
     * The distinction is the whole point of the assertion. An `aria-label` would satisfy a screen
     * reader and NOTHING ELSE: `scripts/footer-audit.ts` reads `textContent` and would report "a
     * link with no text", and a reader with SVG suppressed meets two empty boxes. So the name is a
     * child of the anchor, hidden with `.cf-sr` — which is `clip-path`, not `display:none`, and is
     * therefore still in the accessibility tree.
     */
    for (const s of FOOTER_SOCIAL_LINKS) {
      const found = anchors(SIGNED_OUT).find((a) => a.href === s.href)
      assert.ok(found, `${s.key} is not linked`)
      assert.equal(found.text, s.label, `${s.key} does not carry its own label as text`)
      assert.ok(
        SIGNED_OUT.includes(`<span class="cf-sr">${s.label}</span>`),
        `${s.key}'s name is not the visually-hidden text — an icon link with no readable name`,
      )
    }
    assert.ok(
      !/<a[^>]*aria-label=/.test(SIGNED_OUT),
      'a footer link names itself with aria-label; use .cf-sr text, which the browser guard can see',
    )
  })

  it('names the account rather than the platform', () => {
    // "GitHub" alone, announced out of context beside "Forge Market" and "Terms of service", does
    // not say whose GitHub it is.
    for (const s of FOOTER_SOCIAL_LINKS) {
      assert.match(s.label, /^CloudsForge on /, `"${s.label}" names a platform and not an account`)
    }
  })

  it('carries rel="me noopener" and opens nothing in a new tab', () => {
    for (const s of FOOTER_SOCIAL_LINKS) {
      const anchor = new RegExp(`<a[^>]*href="${s.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`)
      const tag = anchor.exec(SIGNED_OUT)?.[0] ?? ''
      assert.ok(tag !== '', `${s.key} is not rendered as an anchor`)
      assert.ok(tag.includes('rel="me noopener"'), `${s.key} is missing rel="me noopener": ${tag}`)
      assert.ok(!tag.includes('target='), `${s.key} decides for the reader that it opens a new tab`)
    }
  })

  it('draws each mark with currentColor, so it wears the footer’s ink', () => {
    // The alternative is two brand colours, which would be the only two hex literals in a
    // stylesheet whose whole discipline is that it has none.
    const marks = [...SIGNED_OUT.matchAll(/<svg class="cf-foot__socialicon"[^>]*>/g)]
    assert.equal(marks.length, FOOTER_SOCIAL_LINKS.length, 'one mark per social link')
    for (const m of marks) {
      assert.ok(m[0]?.includes('fill="currentColor"'), `a social mark hard-codes its fill: ${m[0]}`)
      assert.ok(m[0]?.includes('aria-hidden="true"'), 'a social mark is announced beside its own name')
      assert.ok(m[0]?.includes('focusable="false"'), 'a social mark is a second tab stop inside a link')
    }
  })

  it('is a list of two, announced as one', () => {
    assert.match(SIGNED_OUT, /<ul class="cf-foot__social">/)
  })

  it('has a focus ring in the stylesheet, and it is an outline rather than a colour swap', () => {
    /*
     * Asserted against the CSS because there is nowhere else it can be asserted: the markup cannot
     * show a focus treatment, and a colour-only focus state on an icon link is invisible to exactly
     * the reader it exists for. Read as text rather than parsed — this is one rule, by name.
     */
    const css = readFileSync(join(HERE, 'ui.css'), 'utf8')
    const rule = /\.cf-foot__sociallink:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    assert.ok(rule !== '', '.cf-foot__sociallink has no :focus-visible rule')
    assert.match(rule, /outline:\s*2px solid var\(--cf-accent\)/, `focus ring is not an outline: ${rule}`)
    assert.ok(!/#[0-9a-f]{3,8}/i.test(rule), `the focus ring carries a hex literal: ${rule}`)
  })
})

/* ═══════════════════════ the columns a surface adds (micro-org#489) ══════════════════════ */

describe('a surface may add columns and may not remove any', () => {
  const OWN = renderToStaticMarkup(
    createElement(CloudsForgeFooter, {
      current: 'site',
      columns: [
        { title: 'This site', links: [{ href: 'https://example.test/about', label: 'About' }] },
      ],
    }),
  )

  it('renders the extra column as a labelled nav with an h2, like every other', () => {
    const id = /<nav class="cf-foot__col" aria-labelledby="([^"]+)"><h2 class="cf-foot__title" id="\1">This site<\/h2>/.exec(OWN)
    assert.ok(id, 'the added column is not a nav labelled by its own heading')
  })

  it('places it after the registry columns and before Legal', () => {
    // The reader's model of the row: elsewhere in the estate, then this site, then the small print.
    const own = OWN.indexOf('>This site<')
    const products = OWN.indexOf('>Products<')
    const legal = OWN.indexOf('>Legal<')
    assert.ok(products < own && own < legal, `order is products ${products}, own ${own}, legal ${legal}`)
  })

  it('still renders every registry link, the legal links and the socials', () => {
    // The half that makes this additive rather than an escape hatch: there is no prop that removes
    // a column, so a surface cannot use this to go back to a footer of its own.
    const hrefs = new Set(anchors(OWN).map((a) => a.href))
    const hosts = cloudsforgeHosts()
    for (const s of FOOTER_SURFACES) {
      if (s.adminOnly) continue
      assert.ok(hrefs.has(hosts[s.key]), `${s.key} was dropped when a column was added`)
    }
    for (const l of FOOTER_LEGAL_LINKS) assert.ok(hrefs.has(`${hosts.site}${l.path}`), l.label)
    for (const s of FOOTER_SOCIAL_LINKS) assert.ok(hrefs.has(s.href), s.label)
  })

  it('changes nothing when omitted', () => {
    assert.ok(!SIGNED_OUT.includes('cf-foot__col" aria-labelledby="'.concat('own')))
    assert.equal(
      [...SIGNED_OUT.matchAll(/<nav class="cf-foot__col"/g)].length,
      FOOTER_GROUPS.filter((g) => g.surfaces.some((s) => !s.adminOnly)).length + 1,
    )
  })
})

/* ═════════════════ the legal hrefs a surface may decorate (micro-org#484) ═════════════════ */

/**
 * Forge Network renders one estate or the other and carries `?net=` on every link it offers. It
 * can wrap the surface links through `surfaceUrls`; these three are composed inside the component,
 * so before this hook they were the only hrefs on the page that dropped the reader's viewed network
 * — silently, on the way to the privacy notice.
 */
describe('a surface may decorate the legal hrefs', () => {
  const CARRIED = renderToStaticMarkup(
    createElement(CloudsForgeFooter, {
      current: 'network',
      legalUrl: (url: string) => `${url}?net=testnet`,
    }),
  )

  it('applies the hook to every legal link, including one added later', () => {
    // Asserted over `FOOTER_LEGAL_LINKS` rather than over three literals, which is the reason the
    // hook is a function and not a record keyed by path: a fourth legal page is carried too.
    const site = cloudsforgeHosts().site
    for (const l of FOOTER_LEGAL_LINKS) {
      const found = anchors(CARRIED).find((a) => a.text === l.label)
      assert.ok(found, `${l.label} is missing`)
      assert.equal(found.href, `${site}${l.path}?net=testnet`)
    }
  })

  it('hands over the composed absolute address and the path', () => {
    const seen: { url: string; path: string }[] = []
    renderToStaticMarkup(
      createElement(CloudsForgeFooter, {
        current: 'network',
        legalUrl: (url: string, path: string) => {
          seen.push({ url, path })
          return url
        },
      }),
    )
    const site = cloudsforgeHosts().site
    assert.deepEqual(
      seen,
      FOOTER_LEGAL_LINKS.map((l) => ({ url: `${site}${l.path}`, path: l.path })),
    )
  })

  it('touches nothing but the legal column', () => {
    const hosts = cloudsforgeHosts()
    for (const s of FOOTER_SURFACES) {
      if (s.adminOnly) continue
      assert.ok(
        anchors(CARRIED).some((a) => a.href === hosts[s.key]),
        `${s.key} was rewritten by a hook that is only for the legal links`,
      )
    }
    for (const s of FOOTER_SOCIAL_LINKS) {
      assert.ok(anchors(CARRIED).some((a) => a.href === s.href), s.label)
    }
  })

  it('defaults to the marketing site, unchanged, when no hook is passed', () => {
    const site = cloudsforgeHosts().site
    for (const l of FOOTER_LEGAL_LINKS) {
      assert.ok(anchors(SIGNED_OUT).some((a) => a.href === `${site}${l.path}`), l.label)
    }
  })
})
