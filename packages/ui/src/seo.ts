/**
 * Document metadata for every CloudsForge surface, derived from the surface registry.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS IN THE SHARED PACKAGE
 *
 * The estate's SEO position was not "missing", which is what it looked like from outside — it was
 * SIXTEEN INDEPENDENT COPIES. Thirteen of the sixteen frontends carry a hand-typed `<title>` and
 * `meta description` in their `index.html`; fifteen carry hand-typed Open Graph tags; `site` alone
 * carries a real per-route module. Every one of those strings restates a name and a blurb that
 * `surfaces.ts` already holds, and the restatement has already drifted at least once inside a
 * single repository — `site/index.html` carries a comment recording that its shell and its
 * application disagreed about the home page's own description for as long as it took somebody to
 * open the served HTML.
 *
 * So this module derives from the registry and nothing else. A surface's title is its `name`, its
 * description is composed from its `blurb`, and whether a crawler is invited at all is read from
 * `servesUi` and `adminOnly`. A seventh product is a registry row; it is not seventeen edits.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THREE THINGS THIS DELIBERATELY DOES NOT DO
 *
 * **It names no hostname.** Every absolute URL — the canonical, `og:url`, `og:image` — is composed
 * at RUNTIME from the origin the page was served on. One bundle therefore serves localhost, a
 * preview deployment and the apex, which is the property the whole estate is arranged around
 * (`site/test/no-build-time-config.test.ts` greps for violations of it).
 *
 * **It does not pre-render.** These are single-page applications with one `index.html` each. The
 * tags below are applied by script, which browsers and the crawlers that execute JavaScript see,
 * and which the link-preview fetchers used by chat clients generally do not. Those get whatever
 * the shell carries. That trade is inherited rather than introduced, and it is written down here
 * so the next person makes it deliberately instead of discovering it in a link preview.
 *
 * **It is a pure function.** Nothing here touches the DOM except {@link applyHead}, which is
 * fifteen lines at the bottom. That is what lets a test assert the title of every surface in the
 * estate without a browser.
 */
import { SURFACES, surface, type CloudsForgeSurface, type SurfaceKey } from './surfaces.ts'

/** The company name, as it appears in a title and in `og:site_name`. */
export const SITE_NAME = 'CloudsForge'

/**
 * The document language, as a BCP 47 tag.
 *
 * `en-GB` rather than `en`, and rather than nothing at all. It is the estate's actual voice — the
 * copy spells "recognise" and "colour" — and a screen reader uses this to choose a pronunciation
 * dictionary, so getting it wrong is not cosmetic. Every `index.html` in the estate already
 * declares it; this is the value they declare, named once so a new surface cannot pick another.
 */
export const HTML_LANG = 'en-GB'

/** The company-level card, served from each surface's own `public/`. */
export const DEFAULT_OG_IMAGE = '/og-1200x630.png'

/**
 * The sentence appended to a surface's registry blurb to make a usable description.
 *
 * A registry `blurb` is one clause — "Balances, deposits and withdrawals" — because its real job
 * is a line under a name in a 264px switcher menu. A meta description doing its job is 50 to 160
 * characters; nine words is a description that search engines discard and rewrite from the page.
 * Rather than add a second, longer string to every registry row and let the two drift, the blurb
 * is composed with one sentence about what the platform IS, which is the context a reader arriving
 * from a search result actually lacks.
 */
export const COMPANY_LINE =
  'Part of CloudsForge: EMBER, the chain it runs on, and every surface built on top of it.'

export type TagKind = 'name' | 'property'

export interface MetaTag {
  readonly kind: TagKind
  readonly key: string
  readonly content: string
}

export interface SurfaceMeta {
  /** The full contents of `<title>`. Already suffixed; never suffixed twice. */
  readonly title: string
  /** The meta description and the Open Graph description. */
  readonly description: string
  /** The canonical path. Always begins with `/`, never ends with one except at the root. */
  readonly path: string
  /** The Open Graph card, as a path. Made absolute against the serving origin. */
  readonly image: string
  /** The `content` of `<meta name="robots">`. See {@link robotsDirective}. */
  readonly robots: string
  readonly lang: string
}

/** What a caller may say that the registry cannot. */
export interface PageMetaInput {
  /** This page's own title, e.g. `Activity`. Suffixed with the surface name. */
  readonly title?: string | undefined
  /** This page's own description. Replaces the composed registry one entirely. */
  readonly description?: string | undefined
  /** The canonical path for this page. Defaults to `/`. */
  readonly path?: string | undefined
  /** A card for this page. Defaults to the surface's. */
  readonly image?: string | undefined
  /**
   * Force the robots directive. The registry-derived value is almost always right; this exists for
   * the one case it cannot know — a route that is public on a public surface but must not be
   * indexed, such as a search-results page or a one-time confirmation.
   */
  readonly robots?: string | undefined
}

/**
 * Normalise a pathname before it becomes a canonical.
 *
 * `/products/` and `/products` are one page and must not produce two canonicals — a trailing slash
 * is the classic way one page acquires two addresses and splits its own indexing between them.
 */
export function normalisePath(pathname: string): string {
  if (!pathname.startsWith('/')) return normalisePath(`/${pathname}`)
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * What a crawler is told about a surface, DERIVED rather than decided per repository.
 *
 * Three answers, and each is read off a registry field that already exists:
 *
 *   - `servesUi: false` — nothing is served here at all. There is no page to index and the address
 *     404s or answers JSON. `noindex, nofollow`.
 *   - `adminOnly: true` — Admin, Lantern and Beacon. These serve a real page, and it is a sign-in
 *     panel guarding an operator console. Indexing it publishes the console's address, its name
 *     and its purpose to anyone searching, which is reconnaissance handed over for free. Hiding is
 *     NOT the security boundary — each service verifies the `admin` role on the token — but there
 *     is no argument at all for the alternative. `noindex, nofollow`.
 *   - everything else — `index, follow`, plus `max-image-preview:large` so a product page's card
 *     is rendered at a useful size rather than as a thumbnail.
 *
 * This is the field that was genuinely absent estate-wide, and it is the one with a real cost: the
 * operator console has been indexable since it shipped.
 */
export function robotsDirective(s: CloudsForgeSurface): string {
  if (!s.servesUi || s.adminOnly === true) return 'noindex, nofollow'
  return 'index, follow, max-image-preview:large'
}

/** A surface's description: its registry blurb, made long enough to be one. */
export function descriptionFor(s: CloudsForgeSurface): string {
  // The blurb rarely ends in a full stop, because it is written to sit under a name in a menu.
  const blurb = /[.!?]$/.test(s.blurb) ? s.blurb : `${s.blurb}.`
  return `${blurb} ${COMPANY_LINE}`
}

/**
 * The metadata for a page on a surface.
 *
 * The title is `Page — Surface Name`, or just the surface name at its root, and never the surface
 * name twice: a `<title>` reading "CloudsForge — CloudsForge" is what a naive suffix produces on a
 * front door, and `site` is exactly that case.
 */
export function surfaceMeta(key: SurfaceKey, page: PageMetaInput = {}): SurfaceMeta {
  const s = surface(key)
  const name = s.name
  const title =
    page.title === undefined || page.title === name ? name : `${page.title} — ${name}`
  return {
    title,
    description: page.description ?? descriptionFor(s),
    // ── THE MOUNT IS PART OF THE CANONICAL, AND LEAVING IT OFF WAS A LIVE DEFECT ──────────────
    //
    // `page.path` is a ROUTER path. On a surface mounted at a folder, react-router's `basename`
    // strips the mount before `useLocation()` ever sees it — so a page at `/market/collections`
    // hands this function `/collections`, and the canonical composed from it was
    // `https://<apex>/collections`.
    //
    // MEASURED 2026-08-19 against production: `https://cloudsforge.online/collections` answers
    // **404**, and so do `/fees` and `/pools`. Every page of Forge Market and Forge Exchange was
    // therefore declaring itself canonical at an address that does not exist — on surfaces whose
    // entire reason for moving was to stop throwing authority away. A canonical pointing at a 404
    // is worse than the subdomain it replaced: a crawler that believes it drops the real page.
    //
    // `journal` escaped it only because micro-journal-web pre-renders and asserts
    // `__CF_ORIGIN__${BASE}` in its own suite. Nothing asserted it for the others, which is why
    // this shipped twice.
    //
    // The registry already holds the answer, so this reads it rather than asking each caller to
    // remember: one line here fixes every consolidated surface and every one still to come.
    path: normalisePath(`${s.basePath ?? ''}${page.path ?? '/'}`),
    image: page.image ?? DEFAULT_OG_IMAGE,
    robots: page.robots ?? robotsDirective(s),
    lang: HTML_LANG,
  }
}

/**
 * The tags a page needs, given its metadata and the origin it is served from.
 *
 * `origin` is passed in rather than read from `window`: that is what makes this testable, and what
 * keeps a hostname out of the module. An empty origin yields relative URLs — correct in a test,
 * and never reached in a browser, where the origin is always available.
 *
 * `twitter:image` is emitted as well as `og:image` even though X falls back to the Open Graph tag,
 * because Slack, Discord and Teams each read a slightly different subset and the tag costs a line.
 */
export function metaTags(meta: SurfaceMeta, origin: string): readonly MetaTag[] {
  const absolute = (p: string): string => (origin === '' ? p : `${origin}${p}`)
  return [
    { kind: 'name', key: 'description', content: meta.description },
    { kind: 'name', key: 'robots', content: meta.robots },
    { kind: 'property', key: 'og:type', content: 'website' },
    { kind: 'property', key: 'og:site_name', content: SITE_NAME },
    { kind: 'property', key: 'og:locale', content: meta.lang.replace('-', '_') },
    { kind: 'property', key: 'og:title', content: meta.title },
    { kind: 'property', key: 'og:description', content: meta.description },
    { kind: 'property', key: 'og:url', content: absolute(meta.path) },
    { kind: 'property', key: 'og:image', content: absolute(meta.image) },
    { kind: 'name', key: 'twitter:card', content: 'summary_large_image' },
    { kind: 'name', key: 'twitter:title', content: meta.title },
    { kind: 'name', key: 'twitter:description', content: meta.description },
    { kind: 'name', key: 'twitter:image', content: absolute(meta.image) },
  ]
}

/** The canonical link's href, absolute against the serving origin. */
export function canonicalHref(meta: SurfaceMeta, origin: string): string {
  return origin === '' ? meta.path : `${origin}${meta.path}`
}

/* ───────────────────────────── applying it, in a browser ──────────────────────────────── */

/**
 * Write the metadata into the document.
 *
 * The only impure function here, kept to the smallest possible surface for that reason. Tags are
 * updated IN PLACE rather than appended, so a client-side navigation does not leave the previous
 * page's description in the head beside the current one — which is the bug every hand-rolled
 * version of this has, and which is invisible in a browser because the first matching tag wins.
 *
 * `<html lang>` is set here too. It is usually right in the shell already, and setting it again
 * costs nothing; the case it covers is a surface that renders into a host document it did not
 * write.
 */
export function applyHead(meta: SurfaceMeta, origin: string): void {
  if (typeof document === 'undefined') return
  document.title = meta.title
  document.documentElement.lang = meta.lang

  for (const tag of metaTags(meta, origin)) {
    const selector = `meta[${tag.kind}="${tag.key}"]`
    let element = document.head.querySelector(selector)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(tag.kind, tag.key)
      document.head.appendChild(element)
    }
    element.setAttribute('content', tag.content)
  }

  let link = document.head.querySelector('link[rel="canonical"]')
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', canonicalHref(meta, origin))
}

/** Every surface a crawler is invited to index, in registry order. */
export const INDEXABLE_SURFACES: readonly CloudsForgeSurface[] = SURFACES.filter(
  (s) => robotsDirective(s) === 'index, follow, max-image-preview:large',
)
