/**
 * The SEO layer, asserted against the registry rather than against a fixture.
 *
 * The point of `seo.ts` is that no surface's title, description or robots directive is typed
 * anywhere — all three are read off `surfaces.ts`. So the assertions here are mostly SHAPE
 * assertions over EVERY surface at once, which is the only kind that keeps working when a
 * seventeenth surface is added by somebody who never opens this file.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SURFACES, servesOwnBundle, surface } from './surfaces.ts'
import {
  COMPANY_LINE,
  DEFAULT_OG_IMAGE,
  HTML_LANG,
  INDEXABLE_SURFACES,
  canonicalHref,
  descriptionFor,
  metaTags,
  normalisePath,
  robotsDirective,
  surfaceMeta,
} from './seo.ts'

describe('a canonical path', () => {
  it('collapses the trailing slash that would otherwise split a page in two', () => {
    assert.equal(normalisePath('/products/'), '/products')
    assert.equal(normalisePath('/products'), '/products')
    assert.equal(normalisePath('/'), '/')
    assert.equal(normalisePath(''), '/')
    // The root is the one path that KEEPS its slash: '' is not an address.
    assert.equal(normalisePath('///'), '/')
  })

  it('accepts a path that forgot its leading slash rather than emitting a relative canonical', () => {
    assert.equal(normalisePath('about'), '/about')
  })
})

describe('every surface gets usable metadata', () => {
  it('titles every surface with its registry name, and never doubles it', () => {
    for (const s of SURFACES) {
      assert.equal(surfaceMeta(s.key).title, s.name)
      assert.equal(surfaceMeta(s.key, { title: 'Activity' }).title, `Activity — ${s.name}`)
      // The front door is the case a naive suffix gets wrong: `metaFor('/')` on `site` would read
      // "CloudsForge — CloudsForge".
      assert.equal(surfaceMeta(s.key, { title: s.name }).title, s.name)
    }
  })

  it('gives every surface a description long enough to be one', () => {
    /*
     * A registry blurb is one clause, because its real job is a line in a 264px menu. Search
     * engines discard a description under about 50 characters and rewrite it from the page, which
     * is the same as having none. This is the assertion that the composition in `descriptionFor`
     * actually solves that, for every surface rather than for the ones somebody checked.
     */
    for (const s of SURFACES) {
      const description = surfaceMeta(s.key).description
      assert.ok(
        description.length >= 50 && description.length <= 320,
        `${s.key}: description is ${description.length} characters — "${description}"`,
      )
      assert.ok(description.includes(COMPANY_LINE), `${s.key}: description lost the company line`)
      // One full stop after the blurb, never two: several blurbs already end in one.
      assert.doesNotMatch(description, /\.\./, `${s.key}: doubled full stop — "${description}"`)
    }
  })

  it('lets a page replace the description entirely, because a route knows more than a registry', () => {
    const meta = surfaceMeta('hub', { description: 'Your balances, right now.' })
    assert.equal(meta.description, 'Your balances, right now.')
  })
})

describe('what a crawler is told', () => {
  it('refuses to index anything that serves no page', () => {
    for (const s of SURFACES) {
      if (s.servesUi) continue
      assert.equal(robotsDirective(s), 'noindex, nofollow', `${s.key} is servesUi:false`)
    }
    // And the set is not empty, or the loop above proves nothing.
    assert.ok(SURFACES.some((s) => !s.servesUi), 'no servesUi:false surface in the registry')
  })

  it('refuses to index the operator consoles, by name', () => {
    /*
     * Named as well as swept. `admin`, `lantern` and `beacon` serve a real, well-formed page — a
     * sign-in panel in front of an operator console — so the sweep above does not cover them and a
     * naive "index anything that serves HTML" rule would publish all three to search. This is the
     * single largest thing the estate's SEO position was missing, and it is worth failing loudly
     * if the `adminOnly` branch is ever dropped.
     */
    for (const key of ['admin', 'lantern', 'beacon'] as const) {
      const s = surface(key)
      assert.equal(s.servesUi, true, `${key} no longer serves a page — this test needs rethinking`)
      assert.equal(robotsDirective(s), 'noindex, nofollow', `${key} is indexable`)
      assert.equal(surfaceMeta(key).robots, 'noindex, nofollow')
    }
  })

  it('invites a crawler to the surfaces a person is meant to find', () => {
    for (const key of ['site', 'hub', 'trade', 'market', 'status'] as const) {
      assert.match(surfaceMeta(key).robots, /^index, follow/, `${key} is not indexable`)
    }
    assert.ok(INDEXABLE_SURFACES.length >= 10, `only ${INDEXABLE_SURFACES.length} indexable surfaces`)
    assert.ok(
      !INDEXABLE_SURFACES.some((s) => s.adminOnly === true || !s.servesUi),
      'INDEXABLE_SURFACES contains an operator surface or one that serves nothing',
    )
  })
})

describe('the tags themselves', () => {
  /*
   * ── THE FIXTURE IS A SURFACE ON A SUBDOMAIN, DELIBERATELY ──────────────────────────────────
   *
   * These two assert that `metaTags` and `canonicalHref` make a path ABSOLUTE against whatever
   * origin they are handed and invent no hostname. That is a property of the joining, not of any
   * surface — so the fixture should be one whose `path` is exactly what it was given, or the
   * assertion is really about the mount and the join goes unchecked.
   *
   * It read `trade`, which became `<apex>/trade` in wave 3b: `surfaceMeta` then returned
   * `/trade/markets` and these composed `https://trade.cloudsforge.online/trade/markets` — a
   * hostname that only 301s, with a mount on it. `status` stays on its own hostname permanently
   * (the plan keeps seven groups there), so this fixture will not move again.
   *
   * The MOUNTED join is not lost: `the canonical carries the surface's mount` below asserts it
   * over every registry surface that has one, in both directions.
   */
  const meta = surfaceMeta('status', { title: 'Markets', path: '/markets' })

  it('makes every URL absolute against the origin it was served from, and names no host', () => {
    const tags = metaTags(meta, 'https://status.cloudsforge.online')
    const url = tags.find((t) => t.key === 'og:url')
    const image = tags.find((t) => t.key === 'og:image')
    assert.equal(url?.content, 'https://status.cloudsforge.online/markets')
    assert.match(image?.content ?? '', /^https:\/\/status\.cloudsforge\.online\//)
    assert.equal(
      canonicalHref(meta, 'https://status.cloudsforge.online'),
      'https://status.cloudsforge.online/markets',
    )
  })

  it('emits relative URLs for an empty origin rather than inventing one', () => {
    // The prerender and test case. A module that guessed a hostname here is a module that bakes an
    // environment into an artefact, which is the one thing this estate's bundles may not do.
    const tags = metaTags(meta, '')
    assert.equal(tags.find((t) => t.key === 'og:url')?.content, '/markets')
    assert.equal(canonicalHref(meta, ''), '/markets')
  })

  it('carries every tag a link preview actually reads', () => {
    const keys = metaTags(meta, '').map((t) => t.key)
    for (const required of [
      'description',
      'robots',
      'og:type',
      'og:site_name',
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'twitter:card',
      'twitter:title',
      'twitter:description',
    ]) {
      assert.ok(keys.includes(required), `no ${required} tag`)
    }
    // Open Graph is `property`, Twitter and the standards are `name`. Getting that backwards is
    // the classic silent failure: the tag is present, well-formed and ignored.
    for (const tag of metaTags(meta, '')) {
      const expected = tag.key.startsWith('og:') ? 'property' : 'name'
      assert.equal(tag.kind, expected, `${tag.key} is a ${tag.kind}, should be a ${expected}`)
    }
  })

  it('states the locale in the form Open Graph asks for, not the form the html attribute uses', () => {
    // `og:locale` is `en_GB` with an underscore; `<html lang>` is `en-GB` with a hyphen. They are
    // the same fact in two spellings and this is the one place both are produced.
    assert.equal(HTML_LANG, 'en-GB')
    assert.equal(metaTags(meta, '').find((t) => t.key === 'og:locale')?.content, 'en_GB')
    assert.equal(meta.lang, 'en-GB')
  })
})

describe('descriptionFor', () => {
  it('does not add a second full stop to a blurb that already has one', () => {
    assert.equal(
      descriptionFor({ ...surface('hub'), blurb: 'Already a sentence.' }),
      `Already a sentence. ${COMPANY_LINE}`,
    )
  })
})

describe('the canonical carries the surface\'s mount', () => {
  /*
   * ── THE DEFECT THIS EXISTS FOR, WHICH SHIPPED TWICE ────────────────────────────────────────
   *
   * `page.path` is a ROUTER path. On a surface mounted at a folder, react-router's `basename`
   * strips the mount before `useLocation()` ever sees it — so a page at `/market/collections`
   * hands `surfaceMeta` the string `/collections`, and the canonical composed from it was
   * `https://<apex>/collections`.
   *
   * MEASURED 2026-08-19 against production, after wave 3a shipped:
   *
   *     curl -o /dev/null -w '%{http_code}' https://cloudsforge.online/collections   404
   *     curl -o /dev/null -w '%{http_code}' https://cloudsforge.online/fees          404
   *     curl -o /dev/null -w '%{http_code}' https://cloudsforge.online/pools         404
   *
   * Every page of Forge Market and Forge Exchange was declaring itself canonical at an address
   * that does not exist — on surfaces whose entire reason for moving was to stop throwing
   * authority away. A canonical pointing at a 404 is WORSE than the subdomain it replaced: a
   * crawler that believes it drops the real page.
   *
   * `journal` escaped only because micro-journal-web pre-renders and asserts
   * `__CF_ORIGIN__${BASE}` in its own suite. Nothing asserted it for the others.
   *
   * Derived from the registry rather than named, so the eleven surfaces still to move are covered
   * the moment their row changes.
   */
  it('prefixes basePath for every surface that serves its own bundle at one', () => {
    for (const s of SURFACES) {
      if (!s.basePath || !servesOwnBundle(s)) continue
      assert.equal(
        surfaceMeta(s.key).path,
        s.basePath,
        `${s.key}'s root canonical drops its mount`,
      )
      assert.equal(
        surfaceMeta(s.key, { path: '/anything' }).path,
        `${s.basePath}/anything`,
        `${s.key}'s page canonical drops its mount`,
      )
    }
  })

  it('does NOT prefix a route that lives inside another surface\'s bundle', () => {
    /*
     * ── THE SECOND DEFECT, CAUGHT BY micro-hub-web's CI RATHER THAN BY ME ──────────────────────
     *
     * `signin` carries `basePath: '/account'` and `wallet` carries `/wallet`, and neither is a
     * mounted surface: both are ROUTES INSIDE hub-web's bundle. Its router has no `basename`, so
     * `useLocation()` already hands `surfaceMeta` the full `/account/login` — and the first
     * version of this fix prefixed it into `/account/account/login`.
     *
     * The two cases are indistinguishable from `basePath` alone and opposite in the browser:
     * a `basename` is STRIPPED by the router and must be added back; an ordinary route is not.
     * `servesOwnBundle` is the discriminator, and this is the assertion that keeps it applied.
     */
    for (const s of SURFACES) {
      if (!s.basePath || servesOwnBundle(s)) continue
      const already = `${s.basePath}/somewhere`
      assert.equal(
        surfaceMeta(s.key, { path: already }).path,
        already,
        `${s.key} is a route inside another bundle and its mount was added twice`,
      )
    }
  })

  it('mounts the OG card too, and leaves an absolute URL alone', () => {
    /*
     * ── THE OTHER HALF OF THE SAME DEFECT, MEASURED AGAINST PRODUCTION 2026-08-20 ──────────────
     *
     *     /og-1200x630.png          200   40,465 bytes   (micro-site's card)
     *     /market/og-1200x630.png   200   54,174 bytes   (Forge Market's own)
     *
     * `DEFAULT_OG_IMAGE` is a path inside the bundle's own directory. Unmounted it resolved at
     * the apex root, so every Forge Market link unfurled with the marketing site's picture on it.
     * Nothing broke and nothing was logged, which is why it outlived the canonical defect it
     * shipped beside.
     */
    for (const s of SURFACES) {
      if (!s.basePath || !servesOwnBundle(s)) continue
      assert.equal(
        surfaceMeta(s.key).image,
        `${s.basePath}${DEFAULT_OG_IMAGE}`,
        `${s.key} advertises a card at the apex root, which is micro-site's`,
      )
      assert.equal(
        surfaceMeta(s.key, { image: '/custom.png' }).image,
        `${s.basePath}/custom.png`,
        `${s.key}'s own card path is not mounted`,
      )
    }
  })

  it('never rewrites an absolute card URL, because the caller already decided', () => {
    // An article's card on a CDN, say. Prefixing a mount onto it would corrupt the address.
    for (const url of ['https://cdn.example/a.png', 'http://cdn.example/a.png', '//cdn.example/a.png']) {
      assert.equal(surfaceMeta('market', { image: url }).image, url)
    }
  })

  it('leaves the card alone for a surface with no mount of its own', () => {
    // `site` IS the apex, `hub` owns a hostname, and `signin` is a route inside hub's bundle —
    // whose asset really does live at the origin root.
    for (const key of ['site', 'hub', 'signin'] as const) {
      assert.equal(surfaceMeta(key).image, DEFAULT_OG_IMAGE)
    }
  })

  it('leaves a surface with no basePath exactly as it was', () => {
    // `site` IS the apex and `hub` owns a hostname; neither may acquire a prefix, and the root
    // must stay `/` rather than becoming the empty string, which is not a path.
    assert.equal(surfaceMeta('site').path, '/')
    assert.equal(surfaceMeta('site', { path: '/about' }).path, '/about')
    assert.equal(surfaceMeta('hub').path, '/')
  })

  it('still collapses a trailing slash, mount and all', () => {
    // `normalisePath` runs AFTER the join, so `/market` + `/` is `/market` and not `/market/`.
    // One page must not acquire two addresses and split its own indexing between them.
    const mounted = SURFACES.find((s) => s.basePath)
    assert.ok(mounted, 'no mounted surface in the registry to check')
    assert.equal(surfaceMeta(mounted.key, { path: '/' }).path, mounted.basePath)
  })
})
