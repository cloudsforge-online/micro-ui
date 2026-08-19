/**
 * @cloudsforge/ui — shared identity, account chrome and brand marks.
 *
 * A framework-light, plain-CSS account bar so moving between CloudsForge surfaces feels like one
 * application rather than seven. Import the styles once per app:
 *
 *   import '@cloudsforge/ui/tokens.css'
 *   import '@cloudsforge/ui/ui.css'
 *
 * ...then render <CloudsForgeBar /> at the very top of the app shell, and set two attributes on
 * <html>: `data-cf-product` for the accent and `data-cf-substrate` for the ash ramp.
 *
 * Chart primitives live in ./charts.tsx, published as `@cloudsforge/ui/charts`.
 */
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  FOOTER_GROUPS,
  KNOWN_SUBS,
  SURFACES,
  SWITCHER_SURFACES,
  VIEWING_SURFACES,
  envLabel,
  splitEnvLabel,
  surface,
  type CloudsForgeSurface,
  type ProductKey,
  type SurfaceKey,
  type SwitcherKey,
} from './surfaces.ts'

import { MiningControl, type MiningControlProps } from './mining.tsx'

import {
  analyticsAllowedHere,
  analyticsId,
  denyConsent,
  grantConsent,
  onConsentChange,
  readConsent,
  revokeConsent,
  type ConsentDecision,
} from './consent.ts'

export type { ProductKey, SurfaceKey, SwitcherKey, CloudsForgeSurface }

/**
 * The four cross-cutting concerns, re-exported from the root so a surface adopts them with one
 * import rather than four. Each has its own subpath as well (`@cloudsforge/ui/seo`,
 * `/sitemap`, `/consent`) for the callers that are not React — a build script generating a
 * sitemap has no business pulling in a rendering library.
 */
export {
  ANALYTICS_META_NAME,
  CONSENT_COOKIE_NAME,
  CONSENT_EVENT,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_STORAGE_KEY,
  analyticsAllowedHere,
  analyticsId,
  clearConsent,
  consentCookieDomains,
  deleteAnalyticsCookies,
  denyConsent,
  grantConsent,
  initAnalytics,
  initConsentDefaults,
  onConsentChange,
  readConsent,
  revokeConsent,
  writeConsent,
  type ConsentDecision,
} from './consent.ts'
export {
  COMPANY_LINE,
  DEFAULT_OG_IMAGE,
  HTML_LANG,
  INDEXABLE_SURFACES,
  SITE_NAME,
  applyHead,
  canonicalHref,
  descriptionFor,
  metaTags,
  normalisePath,
  robotsDirective,
  surfaceMeta,
  type MetaTag,
  type PageMetaInput,
  type SurfaceMeta,
  type TagKind,
} from './seo.ts'
export {
  SITEMAP_SURFACES,
  robotsTxt,
  sitemapUrls,
  sitemapXml,
  type SitemapUrl,
} from './sitemap.ts'
export {
  FOOTER_GROUPS,
  FOOTER_SURFACES,
  PRODUCTS,
  PRODUCT_ACCENTS,
  RETIRED_ACCENTS,
  SURFACES,
  SWITCHER_SURFACES,
  VIEWING_SURFACES,
  ENV_LABELS,
  KNOWN_SUBS,
  envLabel,
  splitEnvLabel,
  surface,
  CLOUDSFORGE_EMBER,
  type SurfaceKind,
} from './surfaces.ts'

/**
 * The browser mining control. Re-exported from the root rather than given its own subpath: it is
 * React and it belongs in the bar, so every caller that can use it is already importing from here.
 */
export {
  EMBER_CREDITED_CLAUSE,
  HUB_MINE_PATH,
  MiningControl,
  NOT_PAID_CLAUSE,
  formatHashrate,
  miningOnHub,
  type MiningControlProps,
  type MiningPhase,
  type MiningReadout,
  type MiningSubject,
} from './mining.tsx'

/* =============================== types ============================= */

/** A single switcher entry, resolved for the current environment. */
export interface CloudsForgeProduct {
  key: SwitcherKey
  label: string
  blurb: string
  glyph: string
  accent: string
  url: string
  /** Hidden from the switcher unless the viewer holds the `admin` role. */
  adminOnly?: boolean
  /**
   * The registry's `incomplete` sentence, when the surface has one: a person can open this and
   * the thing it is named after is switched off. Carried through rather than dropped because the
   * switcher is where the click starts, and a warning that arrives on the far side of a
   * navigation has already failed.
   */
  incomplete?: string
  /**
   * The network this entry will show, set ONLY when the reader is viewing a different one and this
   * surface's bundle cannot follow them (no `viewsAnyNetwork` on its registry row).
   *
   * The same argument as `incomplete` one field up, applied to a different fact: the switcher is
   * where the click starts. Leaving it unmarked is what the owner reported — the choice vanished
   * on arrival with nothing having said it would — and marking it on the far side would be a
   * notice about a navigation that has already happened.
   */
  pinnedNetwork?: 'mainnet' | 'testnet'
}

/** Optional override map for surface URLs (e.g. production hosts from env). */
export type ProductUrls = Partial<Record<SwitcherKey, string>>

/** The viewer's account state for the shared bar. */
export interface AccountState {
  signedIn: boolean
  handle?: string | null
  /**
   * The viewer's roles, straight from the Nimbus token claims. Only used to decide whether
   * operator-only surfaces appear in the switcher — omitting it simply hides them, so an app that
   * does not pass it stays correct.
   */
  roles?: readonly string[] | null
}

export interface CloudsForgeLogoProps {
  /** Pixel height of the emblem mark. Defaults to 20. */
  size?: number | undefined
  /** Hide the "CloudsForge" wordmark, showing only the mark. */
  markOnly?: boolean | undefined
}

export interface ProductSwitcherProps {
  /**
   * The surface currently being viewed, marked as active in the menu. Typed as a full
   * `SurfaceKey` rather than a switcher key because Hub and the marketing site render the bar
   * without appearing in it; they simply mark nothing active.
   */
  current: SurfaceKey
  /** Override the resolved surface URLs. */
  productUrls?: ProductUrls | undefined
  /** Reveals operator-only surfaces. Defaults to hidden. */
  isAdmin?: boolean | undefined
  /**
   * The network the reader is looking at, when it is not the one this page is served from.
   *
   * Passed by {@link CloudsForgeBar} from `networkSwitch.selected`, so a surface that already
   * declares its in-app network context gets this for free and one that does not is unchanged.
   * Every entry that can follow the reader is linked WITH the choice; every entry that cannot is
   * marked as staying behind. See {@link resolveProducts}.
   */
  viewedNetwork?: 'mainnet' | 'testnet' | undefined
}

export interface AccountMenuProps {
  account: AccountState
  onSignIn?: (() => void) | undefined
  onSignOut?: (() => void) | undefined
  /**
   * Where the `Account` entry goes. Defaults to {@link accountSettingsUrl}.
   *
   * For a surface that serves its own account screen and would rather keep the reader on it than
   * send them across to Hub. It is an ADDRESS, not a callback, on purpose — see the note on
   * `accountSettingsUrl`.
   */
  accountHref?: string | undefined
}

export interface CloudsForgeBarProps {
  current: SurfaceKey
  account: AccountState
  onSignIn?: (() => void) | undefined
  onSignOut?: (() => void) | undefined
  productUrls?: ProductUrls | undefined
  /** Optional content rendered just left of the account menu. */
  rightSlot?: ReactNode | undefined
  /** Passed through to {@link AccountMenu}. Defaults to {@link accountSettingsUrl}. */
  accountHref?: string | undefined
  /**
   * The browser mining control, rendered immediately left of the account menu.
   *
   * OPT-IN, and deliberately not defaulted. Defaulting it to {@link miningOnHub} would put the
   * control on every surface with a zero-line diff, which is tempting and is the wrong trade: this
   * package is linked into nineteen bundles whose test suites assert on the bar's exact markup —
   * its anchors, its triggers, its class list — so a default would fail the CI of every repository
   * that has not been touched, including the ones nobody is editing this quarter. A surface adopts
   * it with one line (`mining={miningOnHub(hosts().hub)}`) when its own tests are ready for it.
   *
   * Surfaces with NO account context at all (micro-pool-web, which does not mount this bar) reach
   * for {@link MiningControl} directly and place it in their own header.
   */
  mining?: MiningControlProps | undefined
  /**
   * Stage-3 surfaces (read-only) pass {@link NetworkSwitcherProps} to switch data in place;
   * everything else omits this and the switcher navigates to the sibling hostname
   * (micro-org#459 — a money action must never silently target a network the address bar does
   * not name).
   */
  networkSwitch?: NetworkSwitcherProps | undefined
}

/* ========================= host resolution ======================== */

/**
 * Every CloudsForge surface's base URL, resolved for the current environment.
 *
 * Derived from the registry rather than declared: this module exists to end hand-maintained
 * lists, and the version it replaces restated all fourteen keys three times over. A new surface
 * is a registry entry and nothing else.
 */
export type CloudsForgeHosts = Record<SurfaceKey, string>

/**
 * Resolve every surface's base URL through `origin`, which differs only in whether it produces a
 * localhost port or an apex subdomain. A surface with a `basePath` — the wallet inside Hub, the
 * faucet inside the Network site — is a path on another surface's host, so its origin resolves
 * like any other and the path is appended.
 */
function hostsFrom(origin: (s: CloudsForgeSurface) => string): CloudsForgeHosts {
  return Object.fromEntries(
    SURFACES.map((s) => [s.key, `${origin(s)}${s.basePath ?? ''}`]),
  ) as CloudsForgeHosts
}

/** Localhost ports (used for `pnpm dev` and the local docker-compose stack). */
const LOCAL_HOSTS: CloudsForgeHosts = hostsFrom((s) => `http://localhost:${s.devPort}`)

/**
 * Is this hostname a local development address?
 *
 * The same three-way test was inlined at four call sites — `cloudsforgeHosts`, `splitEnvLabel`'s
 * two callers, and now `apiBaseFor`, which is what made a fourth copy worth refusing. It decides
 * something load-bearing: a local address has NO GATEWAY in front of it, so a mount that Traefik
 * would strip has to be dropped by the caller instead.
 */
function isLocalHostname(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
}

/**
 * The base a surface's own API is reached at, from a page on that surface.
 *
 * ── WHY THIS IS HERE AND NOT IN SIXTEEN COPIES OF `lib/hosts.ts` ────────────────────────────────
 *
 * Sixteen frontends define a `resolveApiBase` of their own and eleven of them are byte-identical.
 * It is a derivation from the registry, and this estate has now been bitten three times by a
 * SECOND copy of a registry derivation:
 *
 *   `rpcUrl()` in exchange-web    hand-rolled the apex from the hostname, returned null the day
 *                                 the surface became a folder, and every page said "there is no
 *                                 chain endpoint for this address"
 *   `KNOWN_SUBS`                  derived, and correct, because it is derived in one place
 *   `hostsFrom` above             appends `basePath` in ONE line, which is why every link in the
 *                                 estate re-pointed itself on the day `journal` moved
 *
 * So this is the one place, and the copies delegate to it.
 *
 * ── THE SAME-ORIGIN BRANCH IS THE WHOLE POINT, AND IT USED TO RETURN `''` ───────────────────────
 *
 * In production a bundle and its service share an origin — nginx serves the bundle, the service
 * serves `/v1` behind the same hostname — so the base was the empty string and requests stayed
 * RELATIVE. That is correct for a surface mounted at the root and it is wrong for one mounted at
 * a path: a relative `/v1/titles` from a page at `/market/anything` resolves to `/v1/titles` at
 * the APEX ROOT, which belongs to micro-site.
 *
 * And micro-site answers. It serves its SPA shell for an unknown path, so the call comes back
 * 200 with an HTML body where JSON was expected — every panel on the page in a failure state,
 * with a completely healthy network tab. That is the failure `deploy/docs/apex-consolidation.md`
 * decision 4 exists to prevent, and it is the half of it that lives in the browser.
 *
 * So the same-origin answer is the surface's own PATH, not the empty string. For a root-mounted
 * surface that path is `/` and this returns `''`, which is what it always returned — the change
 * is invisible to the ten surfaces that have not moved.
 */
export function apiBaseFor(
  pageOrigin: string,
  hosts: CloudsForgeHosts,
  key: SurfaceKey,
): string {
  const own = hosts[key]
  // With no page origin there is nothing for a relative URL to resolve against, so the absolute
  // form is the only correct answer. (Tests and any server-side render land here.)
  if (!pageOrigin) return own
  let url: URL
  try {
    url = new URL(own)
  } catch {
    return own
  }
  // Compare ORIGINS, not whole URLs: a surface with a basePath would otherwise look cross-origin
  // to itself. Under `pnpm dev` the page is on vite's port and the service on the registry's, so
  // the origins genuinely differ and the absolute form is right.
  if (url.origin !== pageOrigin) {
    // ── AND IN DEVELOPMENT THE MOUNT IS DROPPED, BECAUSE THERE IS NO GATEWAY TO STRIP IT ─────
    //
    // A path-mounted surface reaches its API at `/<mount>/v1/…` in production, and that works
    // because Traefik strips `/<mount>` before the service sees it — `stripPrefix`, decision 4 in
    // `deploy/docs/apex-consolidation.md`. THERE IS NO TRAEFIK UNDER `pnpm dev`. The service is a
    // process on its own port serving `/v1/…` at its root, so sending it `/market/v1/titles`
    // would 404 every request a developer makes, on every path-mounted surface, from the first
    // day of wave 3 onwards.
    //
    // `devPort` is the giveaway and says so itself: it names the thing you CALL. For `market` that
    // is `micro-market` on 4007, and `micro-market` has never heard of `/market`.
    //
    // ONLY LOCAL. Viewing the other estate is also cross-origin — `viewedHosts()` re-points
    // `market` to `https://testnet.cloudsforge.online/market` — and there the mount MUST stay,
    // because the testnet gateway strips it exactly as the mainnet one does. So the discriminator
    // is not "cross-origin", it is "is there a gateway in front of this", and the honest reading
    // of that is whether the target is a local dev address.
    return isLocalHostname(url.hostname) ? url.origin : own
  }
  // Same origin: the mount, with no trailing slash so callers can concatenate `/v1/…` onto it.
  // `/` becomes `''`, which is the relative form every root-mounted surface has always used.
  const mount = url.pathname.replace(/\/+$/, '')
  return mount === '/' ? '' : mount
}

/**
 * Resolve every CloudsForge base URL from the browser's current hostname, so a SINGLE build works
 * both locally and in production behind the gateway — no rebuild per environment.
 *
 * - `localhost` / `127.0.0.1` / anything `.local` → the local dev ports above.
 * - `cloudsforge.online` (or `trade.cloudsforge.online`, …) → the matching
 *   `https://<sub>.cloudsforge.online` subdomains, with the apex derived by stripping a KNOWN
 *   subdomain prefix. An unknown prefix is left alone: a preview deployment at
 *   `pr-42.example.dev` is its own apex, and guessing otherwise would send its sign-in redirect
 *   somewhere that does not exist.
 * - `hub-testnet.cloudsforge.online` (or the bare `testnet.cloudsforge.online`) → the matching
 *   `https://<sub>-testnet.cloudsforge.online` siblings. See below.
 *
 * ── THE ENVIRONMENT IS PART OF THE FIRST LABEL, AND THAT IS THE WHOLE OF THIS FUNCTION ────────
 *
 * Two environments share the apex `cloudsforge.online`. They are told apart INSIDE the first
 * label, by a suffix:
 *
 *     mainnet   hub.cloudsforge.online          -> apex cloudsforge.online, env ''
 *     testnet   hub-testnet.cloudsforge.online  -> apex cloudsforge.online, env 'testnet'
 *               testnet.cloudsforge.online      -> apex cloudsforge.online, env 'testnet'
 *                                                  (the apex surface: no subdomain to suffix)
 *
 * Testnet used to be an apex PREFIX — `hub.testnet.cloudsforge.online` — and that shape needed no
 * code here, because stripping `hub.` left `testnet.cloudsforge.online` and every sibling composed
 * under it. It was also unreachable: Cloudflare's Universal SSL is `*.cloudsforge.online`, a
 * wildcard matches one label, and every two-label testnet hostname therefore failed the TLS
 * handshake at the edge before reaching this estate. Advanced Certificate Manager would cover it
 * and is not bought. So the names moved, and the model had to move with them.
 *
 * ── WHY THE ORDER MATTERED, WRITTEN DOWN SO IT IS NOT UNDONE ──────────────────────────────────
 *
 * This function changed BEFORE the hostnames did. Reverse the two and the estate spends the gap
 * in its worst possible state: `hub-testnet.cloudsforge.online` is not a known subdomain, so the
 * old code left it whole and composed `trade.hub-testnet.cloudsforge.online` for every sibling —
 * addresses that resolve to nothing. And the obvious repair, adding the suffixed names to
 * `KNOWN_SUBS`, is worse than the defect: the first label would then be STRIPPED, the apex would
 * come out as `cloudsforge.online`, and every link, every sign-in redirect and every API base on
 * every testnet page would point at MAINNET. Nothing errors. Every page loads. The balances on
 * the other side are real. `src/hosts.test.ts` asserts over every registry key in both
 * directions precisely so that neither shape can come back.
 *
 * ── THE OLD TWO-LABEL SHAPE STILL RESOLVES, DELIBERATELY ──────────────────────────────────────
 *
 * `hub.testnet.cloudsforge.online` still derives the apex `testnet.cloudsforge.online` through
 * the `KNOWN_SUBS` branch below, exactly as it always did. Nothing was taken away — so a bundle
 * built after this change and served on an old hostname is correct, and the tunnel and the
 * gateway can move at their own pace instead of at the same instant as a deploy.
 */
export function cloudsforgeHosts(): CloudsForgeHosts {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (!host || isLocalHostname(host)) {
    return LOCAL_HOSTS
  }
  const parts = host.split('.')
  const first = parts[0] ?? ''
  // `parts.length > 2` on both branches: a two-label hostname IS an apex, and there is no first
  // label to spend on a subdomain or an environment without inventing one.
  const env = parts.length > 2 ? splitEnvLabel(first) : null
  if (env) {
    const apex = parts.slice(1).join('.')
    return hostsFrom((s) => `https://${envLabel(s.subdomain, env.env)}.${apex}`)
  }
  const apex = parts.length > 2 && KNOWN_SUBS.has(first) ? parts.slice(1).join('.') : host
  return hostsFrom((s) => `https://${s.subdomain ? s.subdomain + '.' : ''}${apex}`)
}

/* ===================== company-wide SSO helpers =================== */

/**
 * Base URL of the CloudsForge sign-in surface — the single, company-wide login page every product
 * redirects to. `http://localhost:3010/account` in dev, `https://hub.<apex>/account` in production.
 *
 * ── This used to resolve `account`, and `account` is served by nothing ─────────────────────────
 *
 * `cloudsforgeHosts().account` is `https://account.<apex>` / `localhost:4001`. Both addresses are
 * empty: `micro-identity` binds 4001 and renders no HTML (`identity/src/server.ts` §3 forbids it,
 * `identity/src/server.test.ts` asserts the 404s), and no repository in the estate serves the
 * `account.` hostname. So every `Sign in` button in the estate led to a page that has never
 * existed. The registry entry `signin` is the address that IS served — see its note in
 * surfaces.ts for why it rides on Hub rather than claiming a hostname of its own.
 */
export function accountUrl(): string {
  return cloudsforgeHosts().signin
}

/**
 * Where the `Account` entry in the bar's menu goes: the settings page a signed-in reader is asking
 * for. `https://hub.<apex>/settings`, resolved from the registry.
 *
 * ── THIS IS NOT `accountUrl()`, AND THE DIFFERENCE IS THE DEFECT ──────────────────────────────
 *
 * `accountUrl()` resolves the `signin` surface — the page you are sent to when you are NOT signed
 * in. The account menu only exists when you ARE, so pointing it there sends a reader who is
 * already authenticated to a sign-in form, which signs them in again and returns them to the page
 * they pressed it on. That is precisely what shipped: the menu entry's `onClick` was `onSignIn`,
 * the same callback as the `Sign in` button, so there was no route to an account screen from the
 * chrome on any of the nineteen surfaces that render this bar.
 *
 * ── AND WHY IT IS AN `href` RATHER THAN A CALLBACK ────────────────────────────────────────────
 *
 * A `<button onClick>` is a destination that nothing can see. It cannot be middle-clicked or
 * opened in a new tab, its target cannot be copied, and — the reason this went unnoticed for as
 * long as it did — it is invisible to every check that reads links. `footer.test.ts` counts and
 * resolves every anchor the footer emits and would have caught a wrong address here in the first
 * run, had there been an address to read. `hub-web/test/account-link.test.ts` is the assertion
 * that now does, driven through a real click in a real DOM.
 *
 * `/settings` is served by `hub-web` (`src/app.tsx`, `src/pages/settings.tsx`), which is
 * the bundle already behind `hub.<apex>` — so this needs no new hostname, no new container and no
 * DNS, for the same reason the `signin` row rides on Hub. A surface that serves its own account
 * screen overrides it with `accountHref`.
 */
export function accountSettingsUrl(): string {
  return `${cloudsforgeHosts().hub}/settings`
}

/**
 * Redirect the browser to the Account portal to sign in. After a successful login the portal
 * returns to `returnUrl` with a one-time hand-off code in the URL hash (`#cf_code=…`) — redeem it
 * on boot with {@link consumeAuthCallback}. Defaults to returning to the current page.
 */
export function signInRedirect(returnUrl?: string): void {
  const back = returnUrl ?? (typeof window !== 'undefined' ? window.location.href : '')
  window.location.assign(`${accountUrl()}/login?return=${encodeURIComponent(back)}`)
}


/* ---- silent SSO ----------------------------------------------------------------------------- */

/**
 * The name of the hint. Per environment, because mainnet and testnet share the apex
 * `cloudsforge.online` and a cookie set by one is sent to the other: without the suffix a
 * mainnet session would send every testnet surface on a probe that can only come back `none`.
 */
function ssoHintName(): string {
  const host = typeof window === 'undefined' ? '' : window.location.hostname
  const parts = host.split('.')
  const env = parts.length > 2 ? splitEnvLabel(parts[0] ?? '') : null
  return env?.env ? `cf_sso_${env.env}` : 'cf_sso'
}

/**
 * The domain the hint is written on: the apex all of this estate's surfaces hang off, so that
 * `hub.` can set it and `explorer.` can read it. Null wherever a shared cookie is meaningless
 * (localhost, an IP, a single-label host), which is also every case where the surfaces are on
 * different PORTS of one origin and share storage anyway.
 */
function ssoHintDomain(): string | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (isLocalHostname(host)) return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null
  const parts = host.split('.')
  if (parts.length < 2) return null
  const first = parts[0] ?? ''
  const env = parts.length > 2 ? splitEnvLabel(first) : null
  if (env) return parts.slice(1).join('.')
  return parts.length > 2 && KNOWN_SUBS.has(first) ? parts.slice(1).join('.') : host
}

/**
 * Record that this browser has a portal session — a BOOLEAN, and deliberately nothing else.
 *
 * ── WHY A COOKIE AT ALL, WHEN THE TOKENS LIVE IN `localStorage` ───────────────────────────────
 *
 * `localStorage` is scoped to one origin, and every surface in this estate is its own origin.
 * That is the whole of the defect this closes: a reader who signed in at `hub.` arrived at
 * `explorer.` and was shown a signed-out page, because `explorer.` had no way to find out
 * otherwise. The SSO chain to fix it already existed end to end — the portal hands a code back
 * to any allowlisted origin that asks — and nothing ever ASKED.
 *
 * A cookie on the apex is the one thing every subdomain can read, and it is first-party at each
 * of them, so it survives the third-party cookie rules that make a hidden-iframe silent auth
 * unreliable. It carries no credential and grants nothing: it says only "asking the portal is
 * worth a redirect". Losing it costs a click; forging it costs an attacker a wasted round trip.
 *
 * `SameSite=Lax` so it survives the portal's top-level redirect back here, which is the entire
 * journey it exists to inform.
 */
export function rememberSignedIn(): void {
  const domain = ssoHintDomain()
  if (typeof document === 'undefined' || !domain) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ssoHintName()}=1; Domain=.${domain}; Path=/; Max-Age=2592000; SameSite=Lax${secure}`
}

/** Forget it: a sign-out anywhere, or a probe the portal answered `none`. */
export function forgetSignedIn(): void {
  const domain = ssoHintDomain()
  if (typeof document === 'undefined' || !domain) return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${ssoHintName()}=; Domain=.${domain}; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

/** Is there a hint that this browser has a portal session? */
export function hasSignedInHint(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some((c) => c.startsWith(`${ssoHintName()}=1`))
}

/** Marks that this page load already spent its one probe. Per TAB, so a new tab may try again. */
const SSO_TRIED = 'cf.ssoProbed'

/**
 * If this browser has a session somewhere and this surface does not, go and collect one.
 *
 * Returns `true` when it has started a navigation, in which case the caller must stop: the
 * document is going away and rendering a signed-out shell first would be a visible flash of the
 * wrong state, which is the thing this exists to remove.
 *
 * ── THE THREE GUARDS, AND WHY EACH IS LOAD-BEARING ────────────────────────────────────────────
 *
 * 1. **`hasLocalSession`** — never probe when this surface already has tokens. Obvious, and it is
 *    also what keeps the common case free: a signed-in reader navigating within a surface pays
 *    nothing.
 * 2. **`hasSignedInHint()`** — never probe for a reader who has not signed in anywhere. Without
 *    this, every anonymous visitor to the public marketing page would be bounced through the
 *    portal before seeing it, which is a worse defect than the one being fixed and would be
 *    measured as a bounce rate rather than as a bug.
 * 3. **`SSO_TRIED`** — one probe per tab. The portal answers `cf_sso=none` when it has no session,
 *    and `consumeAuthCallback` clears the hint on that answer; but a hint that fails to clear (a
 *    cookie the browser refuses to overwrite, a portal that errors) would otherwise loop the tab
 *    between two origins for ever. This is the guard that makes the loop impossible rather than
 *    merely unlikely.
 */
export function attemptSilentSignIn(hasLocalSession: boolean): boolean {
  if (typeof window === 'undefined') return false
  if (hasLocalSession) return false
  if (!hasSignedInHint()) return false
  try {
    if (window.sessionStorage.getItem(SSO_TRIED)) return false
    window.sessionStorage.setItem(SSO_TRIED, '1')
  } catch {
    // A browser that refuses session storage gets no probe rather than an unguarded one.
    return false
  }
  const back = window.location.href
  window.location.assign(
    `${accountUrl()}/login?return=${encodeURIComponent(back)}&silent=1`,
  )
  return true
}

/**
 * Redirect the browser to the Account portal to sign out (clearing the shared portal session and
 * revoking the refresh token), then return to `returnUrl`. Clear this app's own local tokens
 * first: the portal cannot reach them.
 */
export function signOutRedirect(returnUrl?: string): void {
  // The hint outlives this app's own tokens unless it is dropped here: leaving it set would send
  // the reader straight back on a probe after they asked to leave.
  forgetSignedIn()
  const back = returnUrl ?? (typeof window !== 'undefined' ? window.location.href : '')
  window.location.assign(`${accountUrl()}/logout?return=${encodeURIComponent(back)}`)
}

/** Tokens issued to this app after redeeming the portal's hand-off code. */
export interface AuthCallbackTokens {
  accessToken: string
  refreshToken: string
  /** Lifetime of the access token in seconds, as identity reports it. */
  expiresIn?: number
}

/**
 * The two identity routes this module speaks, spelled once.
 *
 * ── Why they are named here rather than written into the fetch calls ───────────────────────────
 *
 * The version of this file that shipped posted the hand-off code to `/auth/exchange`.
 * **`micro-identity` has never served `/auth/exchange`.** It serves `POST /auth/handoff` to mint a
 * code and `POST /auth/handoff/redeem` to spend one (`identity/src/server.ts` and,
 * with `/auth/handoff/redeem` in the throttle table). Every SSO callback in the estate
 * therefore 404'd, silently, and `consumeAuthCallback` returned null exactly as it does for a
 * stale code — so it looked like an expiry rather than like a wrong address.
 *
 * The test that was supposed to catch it asserted `fetched.url === '…/auth/exchange'`: it read the
 * URL out of the implementation and compared it to itself, so it passed for any value. The
 * replacement drives these calls against a stand-in that serves ONLY the routes identity serves
 * and 404s the rest — see auth.test.ts. Naming the paths here gives that stand-in and this module
 * one string to disagree about instead of two.
 */
export const IDENTITY_AUTH_ROUTES = {
  /** Mint a single-use, origin-bound hand-off code. `identity/src/server.ts`. */
  handoff: '/auth/handoff',
  /** Spend one. `identity/src/server.ts`. */
  handoffRedeem: '/auth/handoff/redeem',
} as const

/**
 * The one error code for which "ask an operator to add this origin to the allowlist" is true.
 *
 * Restated from `identity/src/handoff.ts`, which exports it under
 * `HANDOFF_ORIGIN_REFUSED_CODE` and is the source of record. It is restated rather than imported
 * for the same reason `IDENTITY_AUTH_ROUTES` above restates two paths: this package may not depend
 * on a service. The difference from the routes is that a drifted value here is SAFE — an unknown
 * code falls through to `'refused'`, which is the old behaviour — whereas a drifted route 404s.
 */
export const HANDOFF_ORIGIN_REFUSED = 'handoff_origin_refused'

/**
 * Why a hand-off could not be minted, in the only four shapes a caller can act on differently.
 *
 *   `origin`      403 `handoff_origin_refused`. The allowlist genuinely refused this origin. THIS
 *                 IS THE ONLY VALUE FOR WHICH "ask an operator to add it" is a true sentence.
 *   `session`     401. The access token presented is not one identity will accept — expired, in
 *                 practice. The only useful thing on screen is a sign-in form.
 *   `unreachable` The request got no answer at all: nothing is served there, DNS, offline, CORS.
 *   `refused`     Anything else, including a 2xx whose body carries no usable code.
 */
export type HandoffRefusal = 'origin' | 'session' | 'unreachable' | 'refused'

/** What `POST /auth/handoff` answered, refusals included. */
export type HandoffMint =
  | { readonly ok: true; readonly code: string }
  | {
      readonly ok: false
      readonly refusal: HandoffRefusal
      /** The HTTP status, or 0 when the request never got an answer. */
      readonly status: number
      /** identity's own error code, when it sent one and it was readable. */
      readonly errorCode: string | null
    }

/** Options for {@link mintHandoff}. */
export interface MintHandoffOptions {
  /**
   * Mint a fresh access token, called AT MOST ONCE and only on a 401.
   *
   * This package holds no tokens and no storage — every consumer keeps its own — so the refresh
   * that `hub-web`'s `nimbus()` performs inside its own request core cannot live here. The
   * callback is that hook: return a new access token and the mint is retried once with it, return
   * null and the answer stands as `session`.
   *
   * A caller that passes nothing keeps the old behaviour exactly, which is what makes this
   * additive: nineteen surfaces link this package, and a required option would have been a break.
   */
  refresh?: (() => Promise<string | null | undefined>) | undefined
}

/** identity's error envelope is `{ error: { code, message } }`. A gateway's HTML page is not. */
async function handoffErrorCode(res: { json: () => Promise<unknown> }): Promise<string | null> {
  try {
    const body: unknown = await res.json()
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code
    return typeof code === 'string' && code !== '' ? code : null
  } catch {
    return null
  }
}

/**
 * Mint an SSO hand-off code for `redirectOrigin`, using a session this surface already holds.
 *
 * Called by the sign-in surface once credentials have been accepted, and by nothing else: the
 * caller must present an access token, and identity refuses an origin that is not on
 * `IDENTITY_HANDOFF_ORIGINS` (`identity/src/handoff.ts`) rather than minting a code that
 * could not be redeemed. `redirectOrigin` is an ORIGIN — scheme, host and port, no path — because
 * that is what a browser puts in the `Origin` header of the redemption POST, and the two are
 * compared for equality when the code is spent.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ── WHY THIS EXISTS BESIDE `mintHandoffCode` (micro-org#480) ──────────────────────────────────
 *
 * `mintHandoffCode` collapses every non-2xx to `null`, under a comment that said so on purpose:
 * "There is nothing useful for a caller to do with the distinction between 'that origin is not
 * allowed' and 'that token is not valid'". **That was wrong, and it cost the owner an afternoon.**
 *
 * The estate's sign-in surface maps that `null` to one sentence, and the sentence it picked names
 * the allowlist: "You are signed in, but CloudsForge will not hand a session to
 * https://cloudsforge.online … ask an operator to add it to the hand-off allowlist." MEASURED on
 * 2026-08-17: the apex WAS on the live allowlist, `POST /auth/handoff` answered 201 for it, and
 * identity's audit log held not one refusal for that origin. What was actually happening is the
 * 401 — hub keeps tokens in `localStorage`, so they outlive a browser restart, its `hasSession()`
 * tests presence rather than expiry, and an access token older than `ACCESS_TTL_SECONDS` is simply
 * stale. The reader was sent to ask an operator to fix a list that was already correct.
 *
 * A message that cannot tell "the thing is broken" from "I could not present a session" is worse
 * than no message: it names a specific, plausible, already-correct cause and spends the next
 * person's time on it. So identity made the two distinguishable ON THE WIRE (micro-identity#22,
 * merged: 403 `handoff_origin_refused` for the allowlist, 401 for a stale token) — and this is the
 * half of that fix that lives in the browser. The wire distinction is worth nothing while the
 * client throws it away one stack frame later.
 *
 * The 401 is not only reported, it is RECOVERED FROM: pass `refresh` and a stale access token
 * costs one extra round trip instead of a dead end, which is what `hub-web`'s `nimbus()` has
 * always done for every other call it makes. Once, never in a loop — a refresh that does not fix
 * a 401 is a session that is over.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export async function mintHandoff(
  accessToken: string,
  redirectOrigin: string,
  options: MintHandoffOptions = {},
): Promise<HandoffMint> {
  const post = (token: string): Promise<Response> =>
    fetch(`${cloudsforgeHosts().nimbus}${IDENTITY_AUTH_ROUTES.handoff}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ redirectOrigin }),
    })

  let res: Response
  try {
    res = await post(accessToken)
    if (res.status === 401 && options.refresh) {
      const fresh = await options.refresh()
      if (typeof fresh === 'string' && fresh !== '') res = await post(fresh)
    }
  } catch {
    // A throw from `fetch` is not a refusal by identity — identity was never reached. Reporting it
    // as one would send the reader to an operator about an allowlist over a dropped wifi link.
    return { ok: false, refusal: 'unreachable', status: 0, errorCode: null }
  }

  if (!res.ok) {
    const errorCode = await handoffErrorCode(res)
    // The status is read BEFORE the code: a 401 is a stale session whatever body came with it, and
    // only a service that says `handoff_origin_refused` is talking about the allowlist. An
    // unrecognised code is `refused`, which is exactly what every non-2xx used to be.
    const refusal: HandoffRefusal =
      res.status === 401 ? 'session' : errorCode === HANDOFF_ORIGIN_REFUSED ? 'origin' : 'refused'
    return { ok: false, refusal, status: res.status, errorCode }
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const code = (body as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code.length > 0) return { ok: true, code }
  // A 2xx from something that is not identity — a gateway's courtesy page, a misrouted deploy.
  // It is not a refusal by anybody, but there is no code in it, so it cannot be a success either.
  return { ok: false, refusal: 'refused', status: res.status, errorCode: null }
}

/**
 * {@link mintHandoff}, for a caller that only wants the code.
 *
 * Kept, and kept at this exact signature, because it is what `hub-web` imports and this package is
 * `link:`ed by nineteen surfaces — changing a return type here is a build break in repositories
 * this change has no business touching. `options` is new and optional, so an existing call site
 * compiles and behaves identically.
 *
 * **A caller that renders a sentence about WHY should call `mintHandoff` instead.** Everything
 * this function knows about the difference between a stale token and a refused origin is thrown
 * away in the line below; that discarding is the defect of micro-org#480, and it survives here
 * only so that a caller who genuinely has one outcome on screen may keep saying so.
 */
export async function mintHandoffCode(
  accessToken: string,
  redirectOrigin: string,
  options: MintHandoffOptions = {},
): Promise<string | null> {
  const mint = await mintHandoff(accessToken, redirectOrigin, options)
  return mint.ok ? mint.code : null
}

/**
 * Put a hand-off code on the return address, in the FRAGMENT.
 *
 * The fragment, never the query string: a fragment is not sent to the server, so the code does not
 * appear in the destination's access log, in its referrer chain or in any proxy in between. It is
 * the same reason `consumeAuthCallback` strips it before the redemption request goes out.
 *
 * Any fragment the return address already carried is preserved after the code — an app may keep
 * its own route there, and the redeeming side puts the remainder back on the URL.
 */
export function handoffReturnUrl(returnUrl: string, code: string): string {
  const url = new URL(returnUrl)
  const existing = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
  const params = new URLSearchParams(existing)
  params.set('cf_code', code)
  url.hash = params.toString()
  return url.toString()
}

/**
 * On boot, redeem the SSO hand-off code in `window.location.hash` (`#cf_code=…`) for this app's
 * own tokens. The code is single-use, expires in a minute and is bound to this origin. Call it
 * once before the app hydrates its session, then store the tokens with the app's own storage.
 * Returns null when there is no code, or when redemption fails.
 *
 * The route is `POST /auth/handoff/redeem` — see {@link IDENTITY_AUTH_ROUTES} for what it was
 * before, why that 404'd everywhere, and why the test that guarded it could not fail.
 *
 * THE ORDER OF THE TWO SIDE EFFECTS IS DELIBERATE. The hash is stripped with
 * `history.replaceState` BEFORE the exchange request is sent, not after it resolves. A code left
 * in the address bar during a network round trip is a code in the browser history, in the
 * referrer of anything the page loads next, and in any screenshot or bug report taken while the
 * request is in flight — and if the exchange throws, an "after" version never strips it at all.
 * The exchange still succeeds because the code was captured into a local before the URL changed.
 */
export async function consumeAuthCallback(): Promise<AuthCallbackTokens | null> {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash
  const hash = raw.startsWith('#') ? raw.slice(1) : raw
  if (!hash) return null
  const params = new URLSearchParams(hash)

  // The portal answering a silent probe with "nobody is signed in here". Strip it, drop the hint
  // that sent us, and report no session — `attemptSilentSignIn` will not ask again this visit.
  if (params.get('cf_sso') === 'none') {
    params.delete('cf_sso')
    forgetSignedIn()
    const left = params.toString()
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search + (left ? `#${left}` : ''),
    )
    return null
  }

  const code = params.get('cf_code')
  if (!code) return null

  // Strip the code, preserving any other hash content — an app may keep its own route there.
  params.delete('cf_code')
  const rest = params.toString()
  const url = window.location.pathname + window.location.search + (rest ? `#${rest}` : '')
  window.history.replaceState(null, '', url)

  try {
    // No `authorization` header and no credentials: the code IS the credential, and it is bound to
    // this origin — which the browser states in `Origin` on every cross-site POST and identity
    // matches against the value the code was minted for (`identity/src/handoff.ts`).
    const res = await fetch(`${cloudsforgeHosts().nimbus}${IDENTITY_AUTH_ROUTES.handoffRedeem}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const tokens = readCallbackTokens(body)
    // This browser now demonstrably has a portal session. Record the hint so the OTHER surfaces
    // can know to ask for one silently instead of rendering signed-out at a signed-in reader.
    if (tokens) rememberSignedIn()
    return tokens
  } catch {
    return null
  }
}

/**
 * Read the redemption response, or nothing.
 *
 * A cast would have made `setTokens(undefined)` the failure mode for any answer that is not the
 * one expected — a gateway's HTML error page parsed as JSON, a 200 from something that is not
 * identity — and the app would then have believed it held a session while storing `undefined`
 * under the token key. This checks the two fields it is about to use and nothing else; it is not
 * a schema, and it asserts no rule about what identity is allowed to send.
 */
function readCallbackTokens(body: unknown): AuthCallbackTokens | null {
  if (typeof body !== 'object' || body === null) return null
  const { accessToken, refreshToken, expiresIn } = body as Record<string, unknown>
  if (typeof accessToken !== 'string' || accessToken === '') return null
  if (typeof refreshToken !== 'string' || refreshToken === '') return null
  return {
    accessToken,
    refreshToken,
    ...(typeof expiresIn === 'number' ? { expiresIn } : {}),
  }
}

/* ========================= switcher registry ====================== */

/**
 * Resolve every switcher entry's URL, layering an override map over the resolved hosts.
 *
 * Operator-only surfaces are omitted unless `isAdmin`. Hiding is not the security boundary — each
 * service verifies the `admin` role on the token itself — it just keeps a menu entry nobody can
 * open out of every player's face.
 *
 * ── `viewedNetwork`, AND THE TWO ANSWERS IT PRODUCES ─────────────────────────────────────────
 *
 * Pass the network the reader is VIEWING and every entry is resolved against it:
 *
 *   - a surface whose bundle can show it (`viewsAnyNetwork` on the registry row) is linked with
 *     the choice attached, so the reader arrives still looking at it;
 *   - a surface whose bundle cannot is linked EXACTLY AS BEFORE and marked `pinnedNetwork`, so
 *     the menu says which network it will show before the click rather than after it.
 *
 * The second case is the honest half and it is not a stopgap. There is nowhere to send a reader
 * to see testnet Forge Market: the combined view retired the testnet frontends, `market-testnet.
 * <apex>` 302s to `market.<apex>`, and a bundle with no `viewed.ts` reads its own origin. The
 * alternatives are to link it anyway and let the network vanish silently — the reported bug — or
 * to attach a parameter that surface will ignore, which is the same silence with a longer URL.
 *
 * Omit the argument and this is byte-for-byte what it always was, which is what keeps every
 * surface that has not adopted the in-app switcher unchanged.
 */
export function resolveProducts(
  productUrls?: ProductUrls,
  isAdmin = false,
  viewedNetwork?: 'mainnet' | 'testnet',
): CloudsForgeProduct[] {
  const hosts = cloudsforgeHosts()
  const here = currentNetwork()
  // Only when the two DIFFER. A reader viewing the network they are already served is in the
  // ordinary case, and marking every entry "Mainnet only" on a mainnet page would be a label on
  // nineteen surfaces that says nothing. `here` is null off-registry (localhost), where there is
  // no other network to be viewing and the switcher is hidden anyway.
  // The pair, or nothing: `target` is what the reader is looking at, `served` is what a surface
  // that cannot follow will show them instead. Kept together because each entry needs exactly one
  // of the two and picking the wrong one silently produces the bug this fixes.
  const viewing =
    viewedNetwork !== undefined && here !== null && viewedNetwork !== here
      ? { target: viewedNetwork, served: here }
      : null
  return SWITCHER_SURFACES.filter((p) => isAdmin || !p.adminOnly).map((p) => {
    const key = p.key as SwitcherKey
    const url = productUrls?.[key] ?? hosts[p.key]
    const follows = p.viewsAnyNetwork === true
    return {
      key,
      label: p.name,
      blurb: p.blurb,
      glyph: p.glyph,
      accent: p.accent,
      url: viewing && follows ? withNetwork(url, viewing.target) : url,
      ...(p.adminOnly ? { adminOnly: true as const } : {}),
      ...(p.incomplete ? { incomplete: p.incomplete } : {}),
      ...(viewing && !follows ? { pinnedNetwork: viewing.served } : {}),
    }
  })
}

/* ============================ primitives ========================== */

/**
 * Shared dropdown behaviour: closes on outside click and on Escape, and returns focus to the
 * trigger on Escape. Keeps every popover keyboard-friendly without a dependency.
 */
function useDropdown() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, rootRef, triggerRef }
}

function Caret() {
  return (
    <svg className="cf-btn__caret" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2 4l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ============================= the marks ========================== */

/**
 * The product marks, inline.
 *
 * Every mark is drawn to one construction so the set reads as one family: a 24-unit viewBox, a
 * 2-unit stroke with round caps and joins, a GROUND LINE in --cf-fg-mute (the ash ridge, present
 * in every mark including the company's), and exactly ONE accent element in --cf-accent. No
 * gradients, no shadows, no third colour. They are legible at 16px, which is the size the
 * switcher actually renders them at.
 *
 * These are transcriptions of docs/ecosystem/assets/mark-*.svg, not redrawings. The fallback hex
 * in each `var(--cf-accent, …)` is that surface's registry accent, so a mark dropped into a page
 * that sets no product attribute still comes out the right colour rather than grey.
 */
type MarkKey = 'network' | 'trade' | 'create' | 'market' | 'worlds' | 'hub' | 'site'

const MARK_DRAWINGS: Record<MarkKey, () => ReactNode> = {
  network: () => (
    <>
      {/* ash ridge */}
      <path d="M2 19 L7 19 M17 19 L22 19" stroke="currentColor" opacity=".55" />
      {/* hearth: the fire the estate is built around */}
      <path
        d="M12 2.5 C15.5 6 17 8.6 17 11.4 C17 14.5 14.8 16.6 12 16.6 C9.2 16.6 7 14.5 7 11.4 C7 8.6 8.5 6 12 2.5 Z"
        stroke="var(--cf-accent, #d6412f)"
      />
      {/* inner flame */}
      <path
        d="M12 9 C13.3 10.6 13.8 11.6 13.8 12.5 C13.8 13.6 13 14.3 12 14.3 C11 14.3 10.2 13.6 10.2 12.5 C10.2 11.6 10.7 10.6 12 9 Z"
        fill="var(--cf-accent, #d6412f)"
        stroke="none"
        opacity=".5"
      />
      {/* hearthstone */}
      <path d="M7 19 L17 19" stroke="currentColor" />
    </>
  ),
  trade: () => (
    <>
      {/* ash ridge, here doubling as the baseline an equity curve is measured against */}
      <path d="M2 19 L22 19" stroke="currentColor" opacity=".55" />
      {/* the quench curve: down, then through */}
      <path d="M3 14 L7 17 L11 10 L15 13 L21 4" stroke="var(--cf-accent, #2a9e93)" />
      {/* the mark it crosses: high-water */}
      <path d="M15 6.5 L21 6.5" stroke="currentColor" opacity=".35" strokeDasharray="2 2.5" />
    </>
  ),
  create: () => (
    <>
      {/* ash ridge: the anvil face and its base */}
      <path d="M3 15 L21 15" stroke="currentColor" opacity=".55" />
      <path d="M9 15 L9 19 L15 19 L15 15" stroke="currentColor" opacity=".55" />
      {/* the struck spark: a four-point burst, the moment of making */}
      <path d="M12 2 L12 11 M7.5 6.5 L16.5 6.5" stroke="var(--cf-accent, #b28e1e)" />
      <path
        d="M8.9 3.4 L15.1 9.6 M15.1 3.4 L8.9 9.6"
        stroke="var(--cf-accent, #b28e1e)"
        opacity=".55"
      />
    </>
  ),
  market: () => (
    <>
      {/* ash ridge: the stall floor */}
      <path d="M2 20 L22 20" stroke="currentColor" opacity=".55" />
      {/* the awning: a place where things are offered */}
      <path d="M3 9 L12 4 L21 9" stroke="var(--cf-accent, #9b7bf0)" />
      <path
        d="M3 9 L3 12 M8 9 L8 12 M12 9 L12 12 M16 9 L16 12 M21 9 L21 12"
        stroke="var(--cf-accent, #9b7bf0)"
        opacity=".55"
      />
      {/* the goods */}
      <path d="M8 20 L8 15 L16 15 L16 20" stroke="currentColor" />
    </>
  ),
  worlds: () => (
    <>
      {/* ash ridge: the horizon */}
      <path d="M2 19 L22 19" stroke="currentColor" opacity=".55" />
      {/* the settlement on the ridge */}
      <path d="M4 19 L4 13 L9 9 L14 13 L14 19" stroke="var(--cf-accent, #6d9a49)" />
      <path
        d="M14 19 L14 15 L18 12.5 L20 14 L20 19"
        stroke="var(--cf-accent, #6d9a49)"
        opacity=".65"
      />
      {/* one lit window: someone is still here */}
      <path d="M9 15.5 L9 16.5" stroke="var(--cf-ember, #e8622c)" />
    </>
  ),
  hub: () => (
    <>
      {/* ash ridge: the ground line present in every CloudsForge mark */}
      <path d="M2 18 L8 11 L12 15 L16 9 L22 18" stroke="currentColor" opacity=".55" />
      {/* ember spark, centred: home */}
      <path
        d="M12 3.5 C13.6 5.4 14.4 6.9 14.4 8.1 C14.4 9.7 13.3 10.8 12 10.8 C10.7 10.8 9.6 9.7 9.6 8.1 C9.6 6.9 10.4 5.4 12 3.5 Z"
        fill="var(--cf-ember, #e8622c)"
        stroke="none"
      />
    </>
  ),
  // The company mark. The marketing site is the front door, so it wears it unchanged.
  site: () => (
    <>
      <path
        d="M3 18.5h18M5.5 18.5c1-3.4 3.4-5.2 6.5-5.2s5.5 1.8 6.5 5.2"
        stroke="currentColor"
        opacity=".55"
      />
      <path
        d="M12 3.5c1.9 2.2 3 3.9 3 5.8a3 3 0 11-6 0c0-1.2.5-2.3 1.4-3.4.5 1 .1 1.9-.2 2.6 .7-.5 1.4-1.6 1.8-5z"
        fill="var(--cf-ember, #e8622c)"
        stroke="none"
      />
    </>
  ),
}

export interface MarkProps {
  /** Which surface's mark to draw. A surface with no mark of its own renders nothing. */
  surface: SurfaceKey
  /** Pixel size. Tested at 16, 24 and 32; below 16 the ridge stops reading. */
  size?: number
  /**
   * Force the accent, for the case the switcher has: five marks on one page, each needing its
   * OWN product's colour rather than the colour of the page they are listed on.
   */
  accent?: string
  /** Accessible name. Defaults to the surface's registry name. */
  title?: string
  className?: string
}

/** True when {@link Mark} will draw something for this surface. */
export function hasMark(key: SurfaceKey): boolean {
  return key in MARK_DRAWINGS
}

export function Mark({ surface: key, size = 24, accent, title, className }: MarkProps) {
  const draw = MARK_DRAWINGS[key as MarkKey]
  if (!draw) return null
  const label = title ?? SURFACES.find((s) => s.key === key)?.name ?? 'CloudsForge'
  // The ridge is currentColor, so `color` is what makes it the muted ash the spec asks for; the
  // accent element reads --cf-accent, which is inherited from <html> unless overridden here.
  const style = {
    color: 'var(--cf-fg-mute)',
    ...(accent ? { '--cf-accent': accent } : {}),
  } as CSSProperties

  return (
    <svg
      className={className ?? 'cf-mark'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
      style={style}
    >
      {draw()}
    </svg>
  )
}

/* ============================== Logo ============================== */

/**
 * The CloudsForge emblem: an ember spark cresting an anvil-ash ridge. Pure inline SVG — no image
 * request, no external asset, no flash of a missing logo on a cold cache.
 */
export function CloudsForgeLogo({ size = 20, markOnly = false }: CloudsForgeLogoProps) {
  return (
    <span
      className="cf-logo__inner"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <svg
        className="cf-logo__mark"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        role="img"
        aria-label="CloudsForge"
        fill="none"
      >
        {/* ash ridge / anvil base */}
        <path
          d="M3 18.5h18M5.5 18.5c1-3.4 3.4-5.2 6.5-5.2s5.5 1.8 6.5 5.2"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* ember spark rising — one of the three places --cf-ember is allowed */}
        <path
          d="M12 3.5c1.9 2.2 3 3.9 3 5.8a3 3 0 11-6 0c0-1.2.5-2.3 1.4-3.4.5 1 .1 1.9-.2 2.6 .7-.5 1.4-1.6 1.8-5z"
          fill="currentColor"
        />
      </svg>
      {!markOnly && (
        <span className="cf-logo__word">
          Clouds<b>Forge</b>
        </span>
      )}
    </span>
  )
}

/* ========================= ProductSwitcher ======================= */

/**
 * The product switcher.
 *
 * Each entry carries a mark, a name and a blurb as well as its accent, because colour is never
 * the only channel: a reader who cannot separate two hues still has three other ways to tell two
 * entries apart. The operator tools render below a separator, which is also what keeps their
 * accents from ever being adjacent to a product's.
 */
export function ProductSwitcher({
  current,
  productUrls,
  isAdmin = false,
  viewedNetwork,
}: ProductSwitcherProps) {
  const { open, setOpen, rootRef, triggerRef } = useDropdown()
  const products = resolveProducts(productUrls, isAdmin, viewedNetwork)
  const active = products.find((p) => p.key === current)
  const menuId = useId()
  const firstAdminKey = products.find((p) => p.adminOnly)?.key

  return (
    <div className="cf-pop" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cf-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cf-dot" aria-hidden="true" />
        <span className="cf-switch__label">{active ? active.label : 'Products'}</span>
        <Caret />
      </button>
      {open && (
        <ul className="cf-menu cf-menu--left" id={menuId} role="menu" aria-label="CloudsForge products">
          <li className="cf-menu__label" aria-hidden="true">
            CloudsForge
          </li>
          {products.map((p) => {
            const isCurrent = p.key === current
            // Both halves of the sentence come from one field: `pinnedNetwork` is the network this
            // entry WILL show, and it is only ever set when the reader is viewing the other one.
            const pinned = p.pinnedNetwork
            const leaving = pinned === 'testnet' ? 'mainnet' : 'testnet'
            return (
              // A Fragment, not a wrapper element: a <div> between <ul> and <li> is invalid and
              // makes assistive technology stop counting the list.
              <Fragment key={p.key}>
                {p.key === firstAdminKey && (
                  <li role="none" aria-hidden="true">
                    <hr className="cf-menu__sep" />
                  </li>
                )}
                <li role="none">
                  <a
                    className="cf-menu__item"
                    role="menuitem"
                    href={p.url}
                    aria-current={isCurrent || undefined}
                    onClick={() => setOpen(false)}
                  >
                    <span className="cf-menu__icon" aria-hidden="true" style={{ color: p.accent }}>
                      {hasMark(p.key) ? (
                        <Mark surface={p.key} size={18} accent={p.accent} />
                      ) : (
                        p.glyph
                      )}
                    </span>
                    <span className="cf-menu__text">
                      {/*
                        The tag is a SIBLING of the name, in a row of its own, rather than a child
                        of it. `cf-menu__name` is a published hook — the site's switcher journey
                        reads it to assert what a reader is offered — and a name element that
                        sometimes contains a second word means every consumer of that hook has to
                        know about this feature. It reads "Forge TradeIncomplete" to anything that
                        does not.

                        Not `aria-hidden`, and not a coloured dot: a reader using a screen reader
                        hears "Forge Trade, Incomplete" before choosing it, which is the entire
                        point of putting this in the MENU rather than on the page it leads to. The
                        sentence underneath says what is missing; the tag alone would be a word
                        with no fact behind it.
                      */}
                      <span className="cf-menu__head">
                        <span className="cf-menu__name">{p.label}</span>
                        {p.incomplete && <span className="cf-menu__tag">Incomplete</span>}
                        {pinned && (
                          <span className="cf-menu__tag">
                            {pinned === 'testnet' ? 'Testnet' : 'Mainnet'} only
                          </span>
                        )}
                      </span>
                      <span className="cf-menu__blurb">{p.blurb}</span>
                      {p.incomplete && <span className="cf-menu__note">{p.incomplete}</span>}
                      {pinned && (
                        <span className="cf-menu__note">
                          Opens on {pinned}. This surface cannot show {leaving}.
                        </span>
                      )}
                    </span>
                    {isCurrent && (
                      <span className="cf-menu__check" aria-hidden="true">
                        ●
                      </span>
                    )}
                  </a>
                </li>
              </Fragment>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* =========================== AccountMenu ========================= */

function initialsOf(handle?: string | null): string {
  const h = (handle ?? '').trim()
  if (!h) return '?'
  return h.slice(0, 2)
}

export function AccountMenu({ account, onSignIn, onSignOut, accountHref }: AccountMenuProps) {
  const { open, setOpen, rootRef, triggerRef } = useDropdown()
  const menuId = useId()

  if (!account.signedIn) {
    // The sign-in call to action is the second of the three places --cf-ember is allowed: it is
    // the COMPANY asking you to sign in, on whichever product you happen to be standing on.
    return (
      <button type="button" className="cf-btn cf-btn--ember" onClick={() => onSignIn?.()}>
        Sign in
      </button>
    )
  }

  const handle = account.handle || 'account'

  return (
    <div className="cf-pop" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="cf-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cf-account__avatar" aria-hidden="true">
          {initialsOf(handle)}
        </span>
        <span className="cf-account__handle">{handle}</span>
        <Caret />
      </button>
      {open && (
        <ul className="cf-menu cf-menu--right" id={menuId} role="menu" aria-label="Account">
          <li className="cf-menu__label" aria-hidden="true">
            Signed in as {handle}
          </li>
          <li role="none">
            {/*
              An <a href>, resolved from the registry — NOT a button, and NOT `accountUrl()`.
              This entry used to call `onSignIn`, the same callback as the Sign in button, so the
              one control offering a signed-in reader their account sent them to the sign-in page.
              See `accountSettingsUrl` for why the address is what fixes it and the anchor is what
              keeps it fixed.
            */}
            <a
              className="cf-menu__item"
              role="menuitem"
              href={accountHref ?? accountSettingsUrl()}
              onClick={() => setOpen(false)}
            >
              <span className="cf-menu__icon" aria-hidden="true">
                ◇
              </span>
              <span className="cf-menu__text">
                <span className="cf-menu__name">Account</span>
              </span>
            </a>
          </li>
          <li role="none" aria-hidden="true">
            <hr className="cf-menu__sep" />
          </li>
          <li role="none">
            <button
              type="button"
              className="cf-menu__item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignOut?.()
              }}
            >
              <span className="cf-menu__icon" aria-hidden="true">
                ⏻
              </span>
              <span className="cf-menu__text">
                <span className="cf-menu__name">Sign out</span>
              </span>
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

/* ========================= CloudsForgeBar ======================== */

export function CloudsForgeBar({
  current,
  account,
  onSignIn,
  onSignOut,
  productUrls,
  rightSlot,
  accountHref,
  mining,
  networkSwitch,
}: CloudsForgeBarProps) {
  // The logo goes to the marketing site, which is why the site is not ALSO a switcher entry:
  // two routes to one page cost a slot in a list whose whole job is separation.
  const siteUrl = cloudsforgeHosts().site
  const isAdmin = account.roles?.includes('admin') ?? false
  const barStyle = { colorScheme: 'dark' } as CSSProperties

  return (
    <div className="cf-bar cf-dark" style={barStyle} role="banner">
      <div className="cf-bar__inner">
        <a className="cf-logo" href={siteUrl} aria-label="CloudsForge home">
          <CloudsForgeLogo size={20} />
        </a>
        <span className="cf-bar__sep" aria-hidden="true" />
        {/*
          `viewedNetwork` comes from the SAME state the network switcher renders, which is what
          makes the two controls agree: pick Testnet on the left and every entry in the product
          menu is resolved against that pick, either carrying it or saying it will not. A surface
          that passes no `networkSwitch` passes nothing here, and its menu is unchanged.
        */}
        <ProductSwitcher
          current={current}
          productUrls={productUrls}
          isAdmin={isAdmin}
          {...(networkSwitch?.selected === undefined ? {} : { viewedNetwork: networkSwitch.selected })}
        />
        {/* Beside the product switcher because they answer the same question — "where am I" —
            and a control that moves around between surfaces is hidden on every one of them,
            the argument MiningControl's placement already carries.

            `elsewhere` is computed HERE and not inside the switcher because this is the component
            that knows which surface it is on. A surface passing `onSelect` needs none of it and
            gets none: `viewingSurfaceUrl` answers null for a surface that views in place. */}
        <NetworkSwitcher
          {...(networkSwitch === undefined ? {} : networkSwitch)}
          {...(networkSwitch?.onSelect
            ? {}
            : (() => {
                const to = viewingSurfaceUrl(
                  current,
                  currentNetwork() === 'testnet' ? 'mainnet' : 'testnet',
                  productUrls,
                )
                return to === null ? {} : { elsewhere: to }
              })())}
        />
        <span className="cf-bar__spacer" />
        {rightSlot && <div className="cf-bar__right">{rightSlot}</div>}
        {/*
          BESIDE THE ACCOUNT, ON EVERY PAGE. It sits here and not in `rightSlot` because its
          position is the whole of the change: the owner's complaint was that starting a browser
          miner is "hidden deep in mining page", and a control that moves around between surfaces
          is hidden again. `rightSlot` is each app's own business — search on Hub, a filter
          elsewhere — and would put this at a different place on every one of them.
        */}
        {mining && <MiningControl {...mining} />}
        <AccountMenu
          account={account}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          {...(accountHref === undefined ? {} : { accountHref })}
        />
      </div>
      <TestnetBand {...(networkSwitch?.selected === undefined ? {} : { network: networkSwitch.selected })} />
    </div>
  )
}


/* ============================ NetworkSwitcher (micro-org#459) ============================ */

/**
 * Which network is this page being served FOR — 'mainnet', 'testnet', or null when the question
 * has no answer (localhost, a bare IP, an unrecognised host). Read from the hostname, because on
 * every surface the hostname IS the network: that is the estate's addressing scheme, and it is
 * why this needs no configuration and cannot drift from where the reader actually is.
 */
export function currentNetwork(): 'mainnet' | 'testnet' | null {
  if (typeof window === 'undefined') return null
  const host = window.location.hostname
  if (isLocalHostname(host)) return null
  const parts = host.split('.')
  if (parts.length === 2) return 'mainnet' // the mainnet apex surface
  if (parts.length < 2) return null
  const env = splitEnvLabel(parts[0] ?? '')
  return env?.env === 'testnet' ? 'testnet' : 'mainnet'
}

/* ── THE NETWORK CARRIES IN THE QUERY, BECAUSE IT CANNOT CARRY ANYWHERE ELSE (micro-org#459) ──
 *
 * Every surface in this estate is its own ORIGIN, so `sessionStorage`, `localStorage` and module
 * memory all stop at the hostname. The reader's chosen network is held in module memory by each
 * viewing bundle's `lib/viewed.ts` — which is right, and which is exactly why a link from Forge Hub
 * to the explorer used to arrive with the choice gone. The owner's report:
 *
 *     "if you select testnet and switch product you are back to mainnet"
 *
 * A query parameter is the one channel that survives a cross-origin navigation without being
 * storage. It is a CARRIER and not a store: a viewing bundle reads it once on load to seed its
 * in-memory choice, nothing writes it back, and no reload re-reads it unless the address still has
 * it. So the estate's no-stored-network invariant is untouched — nothing persists — while a link
 * from one surface to another can say which network it was followed FROM.
 *
 * It also survives the combined view's retirement redirect, which matters because that redirect is
 * what makes the old hostname-based carry impossible. Measured 2026-08-14:
 *
 *   $ curl -o /dev/null -w '%{http_code} -> %{redirect_url}' \
 *       'https://market-testnet.cloudsforge.online/products?net=testnet&x=1'
 *   302 -> https://market.cloudsforge.online/products?net=testnet&x=1
 *
 * ── WHAT MUST NOT READ IT, AND WHY THAT IS THE WHOLE SAFETY ARGUMENT ─────────────────────────
 *
 * `NetworkSwitcher` does NOT read this, and neither does `TestnetBand`. A surface with no
 * `viewed.ts` cannot re-point its reads, so honouring `?net=testnet` there would put an amber
 * TESTNET band over live mainnet data — the precise hazard `hub-web/src/lib/viewed.ts` was written
 * to prevent, and a strictly worse outcome than the bug being fixed. Only a bundle that can
 * actually serve the other network's data may adopt it, which is what `viewsAnyNetwork` on the
 * registry row declares and what the product switcher below reads before it composes a link.
 */
export const NETWORK_QUERY_PARAM = 'net'

/**
 * The network named in a URL's query, or null when it names none or names nonsense.
 *
 * Null rather than a default on an unrecognised value: `?net=maiinet` is a typo or a probe, and
 * the honest reading is "this URL says nothing", which leaves the bundle on the hostname's own
 * network. Defaulting a bad value to mainnet would be the same answer by accident, and defaulting
 * it to testnet would let a malformed link change what a page shows.
 */
export function networkFromQuery(search?: string): 'mainnet' | 'testnet' | null {
  const raw = search ?? (typeof window === 'undefined' ? '' : window.location.search)
  const value = new URLSearchParams(raw).get(NETWORK_QUERY_PARAM)
  return value === 'mainnet' || value === 'testnet' ? value : null
}

/**
 * `url` with the viewed network attached — the carrier above, applied to one link.
 *
 * Idempotent, and it OVERWRITES rather than appends: composing a link from a page that already
 * carries `?net=testnet` must not produce `?net=testnet&net=mainnet`, whose meaning depends on
 * which one the reader's browser hands back first.
 *
 * Returns `url` untouched when it is not absolute, since a relative link stays on this origin,
 * where the network is already whatever this page decided.
 */
export function withNetwork(url: string, network: 'mainnet' | 'testnet'): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  parsed.searchParams.set(NETWORK_QUERY_PARAM, network)
  return parsed.toString()
}

/**
 * The address of THIS surface and path on the other network, or null when there is no answer.
 *
 * The hash is dropped, deliberately. The hash is where SSO hand-off codes travel
 * (`consumeAuthCallback`), a code is bound to the origin it was minted for, and carrying one to a
 * different origin replays a credential at an estate that must refuse it. Path and query survive:
 * `/wallet?asset=ltc` means the same thing on both networks, and landing the reader anywhere but
 * the page they were on would make the switcher a hazard instead of a convenience.
 *
 * ── IT CARRIES `?net=`, WHICH IS WHAT MAKES IT STILL WORK AFTER THE RETIREMENT ───────────────
 *
 * This composes `<sub>-testnet.<apex>`, and under the combined view that hostname 302s straight
 * back to `<sub>.<apex>` — so on a surface with no in-place view, pressing Testnet used to be a
 * round trip that landed the reader exactly where they started, on mainnet, with the bar reading
 * Mainnet. Adding the parameter makes the round trip carry the request through the redirect: a
 * bundle that can honour it does, and one that cannot is unchanged and still honest. In a local
 * estate, where both frontends really exist, the destination's own hostname already agrees with
 * the parameter and it is a no-op.
 */
export function siblingNetworkUrl(target: 'mainnet' | 'testnet'): string | null {
  if (typeof window === 'undefined') return null
  const here = currentNetwork()
  if (here === null || here === target) return null
  const host = window.location.hostname
  const parts = host.split('.')
  let sub: string
  let apex: string
  if (parts.length === 2) {
    sub = ''
    apex = host
  } else {
    const env = splitEnvLabel(parts[0] ?? '')
    sub = env ? env.subdomain : (parts[0] ?? '')
    apex = parts.slice(1).join('.')
  }
  const label = envLabel(sub, target === 'testnet' ? 'testnet' : '')
  const nextHost = label ? `${label}.${apex}` : apex
  return withNetwork(
    `https://${nextHost}${window.location.pathname}${window.location.search}`,
    target,
  )
}

/**
 * Where a reader on a surface that CANNOT show `target` should be sent to see it — or null when
 * this surface is itself the answer.
 *
 * `viewsAnyNetwork` on the registry row is the declaration that a bundle re-points its reads in
 * place. A surface without it has no in-app view AND no separate frontend to visit: the combined
 * view retired the `-testnet` hostnames, so composing one is a redirect back to where the reader
 * started. Both halves of that were already written down in `surfaces.ts`; what was missing was
 * anything acting on the first half.
 *
 * ── NOTHING SHIPPED REACHES THIS ANY MORE, AND THAT IS THE POINT OF KEEPING IT ────────────────
 *
 * This was the answer for sixteen surfaces. The owner used it and reported what it is actually
 * like — "in every page when you press testnet it take you to network page testet and if you
 * switch product its reset to mainnet" — which is correct: a reader who presses Testnet on Forge
 * Market is asking for Forge Market, and moving them to a different product is a worse answer than
 * the redirect it replaced. So every frontend gained an in-place view
 * (`@cloudsforge/ui/network-view`) and this now returns null for all of them, which
 * `network-view.test.ts` asserts surface by surface.
 *
 * It stays because the estate gains surfaces. The day a twentieth bundle arrives without a
 * `lib/viewed.ts`, its Testnet button needs to do something better than reload the page it is on,
 * and the alternative — deleting this and rediscovering the need — is how the original defect got
 * shipped.
 *
 * The preference order is deliberate and not registry order. Forge Network is the estate's own
 * overview — chain height, difficulty, the service table — so it is the page that means the most
 * to a reader who just asked "show me testnet" from somewhere that cannot. The explorer is the
 * same answer one level down, and Forge Hub is last because it is behind a sign-in.
 */
export function viewingSurfaceUrl(
  current: SurfaceKey,
  target: 'mainnet' | 'testnet',
  productUrls?: ProductUrls,
): string | null {
  if (VIEWING_SURFACES.some((s) => s.key === current)) return null
  const hosts = cloudsforgeHosts()
  for (const key of ['network', 'explorer', 'hub'] as const) {
    if (!VIEWING_SURFACES.some((s) => s.key === key)) continue
    // `hub` is not a switcher entry, so it can never appear in `productUrls`; the two others can,
    // and an operator override there must win over the hostname-derived default exactly as it does
    // everywhere else in this file.
    const override = (productUrls as Record<string, string | undefined> | undefined)?.[key]
    const url = override ?? hosts[key]
    if (url) return withNetwork(url, target)
  }
  return null
}

export interface NetworkSwitcherProps {
  /**
   * Where to send a reader who picks a network this surface cannot show. Supplied by
   * {@link CloudsForgeBar} from the registry; see {@link viewingSurfaceUrl}.
   *
   * Set, and the inactive option is a LINK to a surface that can show that network, labelled so
   * the reader knows they are leaving before they click. Unset — which is what a surface that
   * passes `onSelect` gets, because it needs no escape — and nothing changes.
   */
  elsewhere?: string | undefined
  /**
   * Stage-3 surfaces (read-only: explorer, network-site, pool-web) pass this to switch the DATA
   * in place instead of navigating. Absent — the default, and the permanent behaviour of every
   * surface with a write path — choosing the other network NAVIGATES to the sibling hostname.
   */
  onSelect?: ((network: 'mainnet' | 'testnet') => void) | undefined
  /** Overrides the highlighted network. Only meaningful with `onSelect` (in-place surfaces). */
  selected?: 'mainnet' | 'testnet' | undefined
}

/**
 * Mainnet | Testnet, in the shared bar, on every surface (micro-org#459 stage 1).
 *
 * Hidden entirely when the network cannot be determined (localhost): a control that guesses is
 * worse than none. The active network is not a link — the switcher exists to LEAVE.
 *
 * ── THE THIRD STATE, AND THE REPORT THAT MADE IT NECESSARY ───────────────────────────────────
 *
 *     "after your latest change im not able at all to change to testnet. reload directly to
 *      mainnet"
 *
 * There were two states here and there are three cases. A surface that re-points its reads passes
 * `onSelect` and switches in place. A surface that does not had no branch of its own: it fell
 * through to `siblingNetworkUrl`, which composes `<sub>-testnet.<apex>` — a hostname the combined
 * view retired. The browser followed the 302 back to the mainnet page it started on, and the bar,
 * reading the hostname, said Mainnet. Sixteen of the nineteen surfaces behaved that way, including
 * the marketing site, which is where a reader is most likely to press it first.
 *
 * The third state is a LINK, not a disabled button. Disabling would be honest and useless: the
 * reader asked to see testnet and the estate can show them testnet, just not from this bundle.
 * So the option carries them to a surface that can — named in the label, so the navigation is
 * announced before the click rather than discovered after it.
 *
 * ── AND THE THIRD STATE IS NOW EMPTY, BECAUSE THE SECOND ONE COVERS EVERY FRONTEND ───────────
 *
 * A link that leaves is still a link that leaves, and the owner's next report was exactly that.
 * Every bundle in the estate now passes `onSelect` — see `@cloudsforge/ui/network-view` — so the
 * press switches the DATA and the reader stays on the page they were reading. The `elsewhere`
 * branch is unreachable from anything shipped and is kept for the surface that has not been built
 * yet, not for one that has.
 */
export function NetworkSwitcher({ onSelect, selected, elsewhere }: NetworkSwitcherProps) {
  const here = currentNetwork()
  if (here === null) return null
  const active = selected ?? here
  const pick = (target: 'mainnet' | 'testnet') => {
    if (target === active) return
    if (onSelect) {
      onSelect(target)
      return
    }
    // `elsewhere` first: this surface cannot show `target`, and the sibling hostname that used to
    // be the answer is a round trip back to here. Only when the registry offers no viewing surface
    // at all does the old composition run, which is the local-estate case where both really exist.
    const url = elsewhere ?? siblingNetworkUrl(target)
    if (url) window.location.assign(url)
  }
  return (
    <div className="cf-netswitch" role="group" aria-label="Network">
      {(['mainnet', 'testnet'] as const).map((n) => {
        const away = n !== active && !onSelect && elsewhere !== undefined
        return (
          <button
            key={n}
            type="button"
            className={`cf-netswitch__opt${n === active ? ' cf-netswitch__opt--active' : ''}${n === 'testnet' ? ' cf-netswitch__opt--testnet' : ''}${away ? ' cf-netswitch__opt--away' : ''}`}
            aria-pressed={n === active}
            {...(away
              ? {
                  title: `This page shows ${active} only. Opens Forge Network on ${n}.`,
                }
              : {})}
            onClick={() => pick(n)}
          >
            {n === 'mainnet' ? 'Mainnet' : 'Testnet'}
            {away && (
              <span className="cf-netswitch__away" aria-hidden="true">
                ↗
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * The origin of THIS surface on `target` — or the empty string when `target` IS this page's own
 * network, because same-network requests must stay relative (that is the contract every surface's
 * `resolveApiBase` already keeps, and an absolute same-origin URL would be a second spelling of
 * it that drifts).
 *
 * Stage 3 of micro-org#459: a read-only surface computes its API base as
 * `networkOrigin(chosen)`, so the SAME bundle reads either estate. Only read-only surfaces may do
 * this; a write path stays relative forever, which pins it to the network the address bar names.
 */
export function networkOrigin(target: 'mainnet' | 'testnet'): string {
  if (currentNetwork() === target) return ''
  const url = siblingNetworkUrl(target)
  if (!url) return ''
  return new URL(url).origin
}

/**
 * The network the reader has CHOSEN in this tab — the stage-3 sessionStorage choice when one
 * exists, the hostname's network otherwise. The non-React read, for API layers that compute a
 * base URL outside the component tree.
 */
export function chosenNetwork(): 'mainnet' | 'testnet' {
  try {
    const kept = window.sessionStorage.getItem('cf.network')
    if (kept === 'mainnet' || kept === 'testnet') return kept
  } catch {
    /* the hostname's network */
  }
  return currentNetwork() ?? 'mainnet'
}

/**
 * The reader's chosen network, held per tab and offered to the bar.
 *
 * sessionStorage rather than localStorage, deliberately: a persisted choice would make a reader
 * who explored testnet LAST WEEK open the explorer today onto testnet data under a mainnet
 * address bar, which is the confusion this whole design exists to prevent. A tab's choice dies
 * with the tab; every fresh tab starts on the network the hostname names.
 */
export function useNetworkChoice(): {
  network: 'mainnet' | 'testnet'
  switcher: NetworkSwitcherProps
} {
  const here = currentNetwork() ?? 'mainnet'
  const [network, setNetwork] = useState<'mainnet' | 'testnet'>(() => {
    try {
      const kept = window.sessionStorage.getItem('cf.network')
      if (kept === 'mainnet' || kept === 'testnet') return kept
    } catch {
      /* a browser that refuses storage gets the hostname's network */
    }
    return here
  })
  const pick = useCallback((target: 'mainnet' | 'testnet') => {
    try {
      window.sessionStorage.setItem('cf.network', target)
    } catch {
      /* held in state alone; the choice still works, it just dies on reload */
    }
    setNetwork(target)
  }, [])
  return { network, switcher: { onSelect: pick, selected: network } }
}

/**
 * The band that makes testnet unmistakable. Rendered by the bar whenever the page IS testnet —
 * a unified experience makes being on the wrong network easier, and the defence is that the wrong
 * network never looks like the right one. Not dismissible, on purpose: a dismissed warning is a
 * warning that was shown once, and this one has to hold for the whole session.
 */
export function TestnetBand({ network }: { network?: 'mainnet' | 'testnet' | undefined } = {}) {
  // A stage-3 surface passes the network the reader is VIEWING, which the hostname no longer
  // determines — mainnet-hosted pages showing testnet data must carry the band, and the reverse
  // must not. Everything else omits the prop and the hostname decides, as before.
  if ((network ?? currentNetwork()) !== 'testnet') return null
  return (
    <div className="cf-testnet-band" role="note">
      TESTNET — coins and balances here have no value
    </div>
  )
}

/* ============================ SkipLink ============================ */

export interface SkipLinkProps {
  /**
   * The `id` of the element focus should land on. Defaults to `main`, which is also the id
   * {@link MAIN_ID} names — use that constant on the `<main>` so the two cannot disagree.
   */
  targetId?: string | undefined
  /** The visible text. Defaults to "Skip to content". */
  children?: ReactNode | undefined
}

/**
 * The id the skip link points at, and the id a surface must put on its `<main>`.
 *
 * Named rather than typed twice: a skip link whose target does not exist is a link that moves the
 * address bar and nothing else, and it is invisible to everything except a person using it.
 */
export const MAIN_ID = 'cf-main'

/**
 * Skip to content — the first focusable element on the page.
 *
 * ── Why this is in the shared package ─────────────────────────────────────────────────────────
 *
 * `site` had one. The other sixteen surfaces did not, so a keyboard or screen-reader reader
 * reached the content of Forge Hub, Forge Market or the operator console by tabbing past the logo,
 * the product switcher and the account menu — on every single navigation. WCAG 2.2 SC 2.4.1
 * (Bypass Blocks, level A) is the criterion, and the shared bar is precisely the "block of content
 * repeated on multiple pages" it is about. The bar is shared, so its bypass has to be.
 *
 * ── The two details that make it actually work ────────────────────────────────────────────────
 *
 * `tabIndex={-1}` belongs on the TARGET, not here — a `<main>` is not focusable by default, so in
 * Chrome and Safari the fragment scrolls the page and leaves focus on the link, and the next Tab
 * goes back to the second item in the bar. {@link MainRegion} sets it; a surface using its own
 * `<main>` must set it too.
 *
 * The rendered element is a real `<a href="#…">` so it works with JavaScript disabled and appears
 * in the accessibility tree as a link rather than as a button that moves focus.
 */
export function SkipLink({ targetId = MAIN_ID, children }: SkipLinkProps) {
  return (
    <a className="cf-skip" href={`#${targetId}`}>
      {children ?? 'Skip to content'}
    </a>
  )
}

export interface MainRegionProps {
  id?: string | undefined
  className?: string | undefined
  children: ReactNode
}

/**
 * The `<main>` landmark, focusable, so {@link SkipLink} actually moves focus into it.
 *
 * Optional — a surface with its own `<main>` keeps it and adds `id={MAIN_ID} tabIndex={-1}`. This
 * exists so that the common case cannot get the two attributes wrong, and so that "every surface
 * has exactly one `main` landmark" is something a browser test can assert by name.
 */
export function MainRegion({ id = MAIN_ID, className, children }: MainRegionProps) {
  return (
    <main id={id} tabIndex={-1} {...(className === undefined ? {} : { className })}>
      {children}
    </main>
  )
}

/* ============================= SubNav ============================= */

export interface SubNavProps {
  /**
   * What a screen reader hears when it lands on the landmark. Required, and deliberately not
   * defaulted to "Sections": a document with two `<nav>` elements — the bar is one — announces
   * both, and two landmarks called "Navigation" are two landmarks nobody can tell apart.
   */
  label: string
  /**
   * The links. Each one should carry `className="cf-subnav__link"` and, when it is the address
   * being read, `cf-subnav__link--current`.
   *
   * The markup is the caller's because the routing is: every surface here uses react-router's
   * `NavLink`, which owns the active state, and this package does not depend on react-router. What
   * is shared is the STRIP — the sticky offset, the scroll behaviour and the measure — which is
   * the part that drifted.
   */
  children: ReactNode
}

/**
 * The second row of the header: this surface's own sections, under the company bar.
 *
 * ── WHY IT IS HERE RATHER THAN IN EACH APP ────────────────────────────────────────────────────
 *
 * Measured 2026-08-10, re-measured the same day against every repository's `main` after a first
 * count proved wrong in both directions: ELEVEN frontends declared this strip in their own
 * stylesheet, under eight different class prefixes, from what was plainly one original — ten as
 * `<prefix>-subnav` (`wt-` in `hub-web`, `mint-web`, `admin-web` and `worlds-web`, then `mk-`,
 * `ex-`, `fs-`, `dp-`, `bw-`, `ln-`) and `tessera-web` as `.tw-nav`, which is the same component
 * under a name that hides it. They had drifted in three ways a reader can see:
 *
 *   1. **Four of the eleven did not survive a narrow viewport.** `market-web`, `mint-web`,
 *      `worlds-web` and `admin-web` set neither `white-space: nowrap` nor `overflow-x`, so a
 *      `display: flex` row with no wrap and no scroll left the links to squeeze and break
 *      mid-label on a phone — ten sections in `admin-web` — with no way to reach the ones past
 *      the edge. The other seven had both, and that is the sharper half of the finding: the fix
 *      existed, was correct, and could not propagate because there was nothing to propagate
 *      through. A shared component is that thing.
 *   2. **Six of the eleven did not share the chrome's measure, at three different widths.**
 *      `76rem`/1216px in `hub-web`, `mint-web`, `worlds-web` and `admin-web`; `78rem`/1248px in
 *      `market-web`; `84rem`/1344px in `lantern-web` — against `var(--cf-max-w)` (1200px) in
 *      `.cf-bar__inner` and `.cf-foot__inner`. On a wide screen the row of sections sat 8px, 24px
 *      or 72px proud of the bar on each side.
 *   3. **It was written in literals.** `0.25rem`, `0.7rem 0.85rem`, `0.875rem`, `76rem` — none of
 *      which move when the scale does. `--cf-text-md` was raised from 0.82rem to 1rem when the
 *      body size was fixed (see the note in `tokens.css`), and not one copy moved with it, which
 *      is why the sections under the bar are still set smaller than the bar's own controls on the
 *      surfaces that have not adopted this.
 *
 * The bar makes moving between surfaces feel like one application. The row immediately beneath it
 * being a different height, a different measure and a different size on each one undoes that at
 * the second glance.
 */
export function SubNav({ label, children }: SubNavProps) {
  return (
    <nav className="cf-subnav" aria-label={label}>
      <div className="cf-subnav__inner">{children}</div>
    </nav>
  )
}

/* ============================ StatusPill ========================== */

export type StatusLevel = 'good' | 'warn' | 'critical' | 'neutral'

export interface StatusPillProps {
  level: StatusLevel
  /** The word. Never optional — it is the accessible content, not a caption. */
  children: ReactNode
  /** Overrides the default glyph. Always `aria-hidden`; the word carries the meaning. */
  glyph?: string | undefined
  /**
   * Announce changes to assistive technology as they happen. Set it on a pill whose level changes
   * without a navigation — a probe going red, a withdrawal settling — and leave it off for a pill
   * that merely describes a row in a table, where twelve live regions would be twelve
   * interruptions.
   */
  live?: boolean | undefined
  className?: string | undefined
}

/** Glyph per level. Colour is never the only channel; this is the second, and the word is the third. */
const STATUS_GLYPHS: Record<StatusLevel, string> = {
  good: '●',
  warn: '▲',
  critical: '■',
  neutral: '○',
}

/**
 * A state, encoded three ways.
 *
 * The estate shows balances, probe verdicts, dispute states and settlement outcomes, and before
 * this it showed them as coloured text. `tokens.css` has said since it was written that "every
 * status mark ships icon + label + colour, because the status page is the one surface a
 * colourblind reader reads under stress" — and there was no primitive that made that true, so it
 * was true wherever somebody remembered.
 *
 * Here it is structural: the word is `children` and cannot be omitted, the glyph is supplied and
 * `aria-hidden`, and the colour comes from the severity tokens, which carry a text-safe step for
 * each level (see tokens.css — `--cf-critical` measures 3.38:1 and two surfaces were already
 * setting text in it).
 */
export function StatusPill({ level, children, glyph, live, className }: StatusPillProps) {
  const cls = ['cf-status', level === 'neutral' ? '' : `cf-status--${level}`, className ?? '']
    .filter(Boolean)
    .join(' ')
  return (
    <span
      className={cls}
      {...(live ? { role: 'status', 'aria-live': 'polite' as const } : {})}
    >
      <span className="cf-status__glyph" aria-hidden="true">
        {glyph ?? STATUS_GLYPHS[level]}
      </span>
      {children}
    </span>
  )
}

/* =========================== CookieBanner ========================= */

export interface CookieBannerProps {
  /**
   * Where "how we use cookies" goes. Defaults to the privacy notice on the marketing site, which
   * is the page that actually describes the processing.
   */
  privacyHref?: string | undefined
  /** Called after either button, with the decision. For a surface that wants to react to it. */
  onDecide?: ((decision: ConsentDecision) => void) | undefined
}

/**
 * The name of the control that makes "you can change your answer" true, written ONCE.
 *
 * The banner's copy is composed from this constant and the control renders it as its whole label,
 * so the sentence and the mechanism cannot be edited apart. `consent-revisit.test.ts` asserts that
 * relationship in both directions, which is the guard the original defect needed and did not have:
 * the banner promised a change of mind for eighteen surfaces and `revokeConsent` had zero call
 * sites anywhere in the estate, so the promise was false everywhere and nothing was red.
 *
 * "Cookie choices" and not "Cookie settings": there are no settings, there is one question with
 * two answers, and a word that implies a panel of switches would be the second false promise in
 * the same sentence.
 */
export const CONSENT_CHOICES_LABEL = 'Cookie choices'

/**
 * The control the banner's promise names.
 *
 * It is a `<button>` and not a link because it does something to this page rather than going
 * somewhere. Its handler is `revokeConsent` ITSELF — not a wrapper, not a local re-implementation
 * — so there is exactly one description of what "change your mind" means:
 *
 *   * `denyConsent` records the refusal, tells Consent Mode to stop, and deletes the `_ga` cookies
 *     already written. A script that is on the page cannot be unloaded, so deleting what it wrote
 *     is the strongest withdrawal a browser allows;
 *   * `clearConsent` then forgets the decision, which puts the banner back on this page view —
 *     `CookieBanner` subscribes to `onConsentChange` — so a reader who wants to go the other way
 *     can answer again immediately, without hunting for a reload.
 *
 * It errs toward withdrawal in both directions, which is the safe way for a consent control to be
 * ambiguous.
 */
export function ConsentChoices() {
  return (
    <div className="cf-consent__revisit-row">
      <button type="button" className="cf-consent__revisit" onClick={revokeConsent}>
        {CONSENT_CHOICES_LABEL}
      </button>
    </div>
  )
}

/**
 * The consent banner, and the only thing in this estate that may cause Google Analytics to load.
 *
 * ── What it does, in order ────────────────────────────────────────────────────────────────────
 *
 * It renders nothing at all until it knows the answer is `null` — that is, until the reader has
 * genuinely not been asked. It renders nothing on a surface with no measurement ID in its shell,
 * and nothing on localhost, because there is nothing to consent TO in either case and a banner
 * asking permission for something that will not happen is worse than no banner.
 *
 * Accept calls `grantConsent`, which is the one call site that injects the tag. Reject calls
 * `denyConsent`, which records the refusal and deletes any GA cookie already present. Neither
 * button is styled as the primary one; see `.cf-consent__choice` in ui.css for why that is a
 * compliance requirement rather than a preference.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────────────────────────
 *
 * `role="dialog"` with `aria-modal={false}` and a `aria-labelledby`: it is a dialog, and it is
 * deliberately NOT modal. A modal consent banner is a focus trap on a page a reader may have
 * arrived at to read something, and trapping them there until they answer is the coercion the
 * regulation is about. They can ignore it, read the page, and answer later.
 *
 * It is rendered LAST in the shell so it is last in the tab order, for the same reason.
 */
export function CookieBanner({ privacyHref, onDecide }: CookieBannerProps) {
  const [decision, setDecision] = useState<ConsentDecision | null | undefined>(undefined)
  const titleId = useId()
  const [id, setId] = useState<string | null>(null)
  const bannerRef = useRef<HTMLDivElement | null>(null)
  const [bannerHeight, setBannerHeight] = useState(0)

  useEffect(() => {
    // Read in an effect rather than in render: `localStorage` and `document.head` are not
    // available during a server render, and reading them in the render body is what makes a
    // component that hydrates to a different tree than it rendered.
    setDecision(readConsent())
    setId(analyticsAllowedHere() ? analyticsId() : null)
    return onConsentChange(setDecision)
  }, [])

  /*
    Measure the banner and reserve that much room at the end of the document.

    The banner is `position: fixed` to the bottom of the viewport, so while it is unanswered it
    sits ON TOP of whatever the last thing on the page is. On the marketing site that is the final
    footer link, and it could not be clicked at all on a first visit — the click landed on
    `.cf-consent__inner` instead. micro-org#241. It is every surface with a footer, which is all of
    them.

    The room is a spacer element in normal flow rather than `padding-bottom` on `body`, because a
    surface that sets its own body padding would silently win or lose that fight depending on
    stylesheet order, and this component is not in a position to know. A block of the right height,
    rendered where the banner already renders — last in the shell — cannot conflict with anything.

    Measured rather than assumed: the banner wraps to two, three or four lines depending on the
    viewport, and a constant here would be right at one width and wrong at the rest. A
    `ResizeObserver` where there is one, and a single read where there is not.
  */
  useEffect(() => {
    const el = bannerRef.current
    if (!el) {
      setBannerHeight(0)
      return
    }
    const measure = (): void => setBannerHeight(el.getBoundingClientRect().height)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [decision, id])

  // `undefined` is "have not looked yet" and must not flash a banner at a reader who already
  // answered. `null` is "looked, and they have not been asked".
  if (id === null || decision === undefined) return null

  /*
   * ANSWERED. The banner is gone and the promise it made is not.
   *
   * This is the whole of the fix for micro-ui's oldest false sentence: the copy below has told
   * readers "you can change your mind at any time" on eighteen surfaces since the banner shipped,
   * and `revokeConsent` — the function that would have made it true — had no call site anywhere in
   * the estate. There was nothing to press.
   *
   * It lives HERE rather than in `CloudsForgeFooter` because three of those eighteen surfaces
   * (micro-explorer-web, micro-site, micro-network-site) render the banner and their own footer,
   * so a control placed in the shared footer would have left the sentence false on exactly the
   * surfaces nobody would think to check. Every surface that can make the promise renders this
   * component, by construction.
   *
   * Last in the shell, so last in the document and last in the tab order — the place a reader
   * looks for it, and out of the way of everything they came for.
   */
  if (decision !== null) return <ConsentChoices />

  const decide = (next: ConsentDecision): void => {
    if (next === 'granted') grantConsent(id)
    else denyConsent()
    setDecision(next)
    onDecide?.(next)
  }

  const privacy = privacyHref ?? `${cloudsforgeHosts().site}/privacy`

  return (
    <>
      {/* The room the fixed banner would otherwise take away. See the measuring effect above. */}
      <div className="cf-consent__spacer" style={{ height: bannerHeight }} aria-hidden="true" />
      <div
        className="cf-consent"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        ref={bannerRef}
      >
        <div className="cf-consent__inner">
          <p className="cf-consent__copy">
            <strong className="cf-consent__title" id={titleId}>
              Analytics on CloudsForge
            </strong>
            We would like to count page views with Google Analytics, which sets a cookie in your
            browser. Nothing is loaded and no cookie is set unless you say yes, you only have to
            answer once for the whole of CloudsForge, and you can change your answer at any time
            {/*
              THE PROMISE NAMES THE CONTROL, and composes its name from the constant the control
              renders. It used to end at "change your mind at any time", which was a promise with
              no mechanism and no address — a reader who believed it had nowhere to go.
            */}
            {` — ${CONSENT_CHOICES_LABEL}, at the foot of every page.`}{' '}
            <a className="cf-consent__link" href={privacy}>
              How we use cookies
            </a>
          </p>
          <div className="cf-consent__actions">
            {/*
              Two buttons, one class, no modifier. The order puts Reject first because a reader
              scanning left to right meets the refusal before the acceptance, which is the opposite
              of the pattern regulators have fined for.
            */}
            <button type="button" className="cf-consent__choice" onClick={() => decide('denied')}>
              Reject
            </button>
            <button type="button" className="cf-consent__choice" onClick={() => decide('granted')}>
              Accept
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ========================= CloudsForgeFooter ====================== */

/**
 * Links that are deliberately NOT registry surfaces.
 *
 * The brief for this component said to drive it from `SURFACES` and, where a link genuinely is not
 * a surface, to say so explicitly rather than blur the two. This is that list, and it is three
 * entries long: all three are ROUTES ON THE MARKETING SITE, resolved against
 * `cloudsforgeHosts().site` so they follow the apex like everything else and are never a typed URL.
 *
 * The paths and the labels are not invented here either — they are `site/src/lib/routes.ts`, whose
 * `ROUTES` carries `terms`, `privacy` and `risk` with `label: null` (that null is what keeps them
 * out of the site header) and a `summary` whose clause before the em dash is the name. This
 * restates those six strings because `@cloudsforge/ui` cannot import from a consumer, and that
 * restatement is the one place in this footer where drift is possible. `footer.test.ts` reads
 * `site`'s route module when a checkout of it is present and fails on disagreement — including on
 * the set itself, so a legal page ADDED to the site is caught here rather than quietly unlinked.
 *
 * ── Why the risk disclosure is in a shared footer and not only the site's own ──────────────────
 *
 * `/risk` says, in plain words, that this platform holds the keys, that the operator can move held
 * assets, that there are no backups and that there is no insurance. Prominence is the whole point
 * of a disclosure: it was reachable only from the marketing site's footer, which is the one place
 * a reader is NOT holding a balance. It belongs on the surfaces where they are — the wallet, the
 * market, the hub — and this list is the only footer those surfaces have.
 *
 * ── What is deliberately absent ───────────────────────────────────────────────────────────────
 *
 * **A security page.** The brief named one as a legitimate non-surface link. Nothing in the estate
 * serves `/security`, and a link that 404s from the footer of nineteen surfaces is a worse defect
 * than the missing footer this component exists to fix. Add the page, then add the link.
 *
 * **A link to the source.** Same reason: these repositories are private, and a footer link to a
 * 404 on GitHub is a link to a login wall.
 *
 * **A copyright year computed from `Date`.** The closing line carries the company name and no
 * year. A year rendered from the reader's clock is a claim about a legal fact, sourced from a
 * device setting.
 */
export const FOOTER_LEGAL_LINKS: readonly { readonly path: string; readonly label: string }[] = [
  { path: '/terms', label: 'Terms of service' },
  { path: '/privacy', label: 'Privacy notice' },
  { path: '/risk', label: 'Risk disclosure' },
]

/* ─────────────────────────────────── the social accounts ─────────────────────────────────── */

/** One account this project publishes under, somewhere that is not this estate. */
export interface FooterSocialLink {
  /** Which mark to draw. A closed union, because each one is a hand-written path below. */
  readonly key: 'github' | 'x'
  /** The profile. Absolute and external by definition — these are the two links that leave. */
  readonly href: string
  /**
   * The link's accessible name, rendered as REAL TEXT inside the anchor and hidden visually.
   *
   * Not an `aria-label`. Three reasons, in order of how much they cost when ignored: an
   * `aria-label` is invisible to the browser guard, which reads `textContent` and would report
   * "a link with no text"; it is invisible to a reader who has images or SVG off, who then meets
   * two empty boxes; and it is the string most likely to be missed by a translation pass, because
   * it is an attribute rather than a child.
   *
   * It names the ACCOUNT and not the platform — "CloudsForge on GitHub", not "GitHub" — because a
   * screen reader announces footer links out of context, and "GitHub" alone in a list beside
   * "Forge Market" and "Terms of service" says nothing about whose GitHub it is.
   */
  readonly label: string
}

/**
 * Where this project is, off this estate. Two accounts, and the list is deliberately short.
 *
 * ── WHY THESE ARE HERE AND THE SOURCE LINK IN `FOOTER_LEGAL_LINKS` STILL IS NOT ───────────────
 *
 * The note above declines "a link to the source", because the repositories are private and a
 * footer link to a 404 on GitHub is a link to a login wall. That reasoning is about a link to a
 * REPOSITORY and it survives: none is added here. The ORGANISATION page is a different address
 * with a different answer — `https://github.com/cloudsforge-online` is served publicly, 200, to a
 * signed-out browser, because an organisation profile does not require a readable repository to
 * exist. Both addresses below were fetched before being written down, which is the standard this
 * footer already holds itself to and the only reason either is here.
 *
 * ── THE MARKS ARE INLINE, AND THAT IS NOT A CONVENIENCE ───────────────────────────────────────
 *
 * `micro-brand` publishes PNG avatars, banners and favicons, and nothing shaped like a platform
 * glyph — its `social/` directory is the estate's own mark resampled for profile pictures, which
 * is the opposite artefact from the one a link to GitHub needs. So these are inline paths at the
 * footer's own weight, `fill="currentColor"`, inheriting the same ink as every link beside them.
 * They are drawn small and quiet on purpose: two icons wearing their platforms' brand colours
 * would be the only two hex literals in a stylesheet whose whole discipline is that it has none,
 * and the loudest thing in a footer whose job is to be findable rather than looked at.
 */
export const FOOTER_SOCIAL_LINKS: readonly FooterSocialLink[] = [
  { key: 'github', href: 'https://github.com/cloudsforge-online', label: 'CloudsForge on GitHub' },
  { key: 'x', href: 'https://x.com/cloudsforge', label: 'CloudsForge on X' },
]

/**
 * The two platform marks, at the footer's weight.
 *
 * `aria-hidden` and `focusable="false"`: the anchor around each already carries the name, and an
 * un-hidden SVG is announced a second time by some combinations of browser and screen reader.
 * `focusable="false"` is the old-IE-shaped attribute that still matters — without it the SVG is a
 * second tab stop inside a link that is already one.
 */
function SocialMark({ mark }: { mark: FooterSocialLink['key'] }) {
  return (
    <svg
      className="cf-foot__socialicon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {mark === 'github' ? (
        <path d="M12 .5C5.73.5.66 5.58.66 11.85c0 5.01 3.25 9.26 7.75 10.76.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.16.69-3.83-1.34-3.83-1.34-.51-1.31-1.26-1.66-1.26-1.66-1.03-.71.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.74.4-1.24.72-1.53-2.52-.29-5.17-1.27-5.17-5.63 0-1.25.44-2.26 1.17-3.06-.12-.29-.51-1.45.11-3.02 0 0 .95-.31 3.12 1.17a10.8 10.8 0 0 1 2.84-.38c.96 0 1.94.13 2.84.38 2.17-1.48 3.12-1.17 3.12-1.17.62 1.57.23 2.73.11 3.02.73.8 1.17 1.81 1.17 3.06 0 4.37-2.66 5.34-5.19 5.62.41.36.77 1.05.77 2.12 0 1.53-.01 2.77-.01 3.14 0 .3.2.66.79.55 4.49-1.5 7.74-5.75 7.74-10.76C23.34 5.58 18.27.5 12 .5Z" />
      ) : (
        <path d="M17.53 3h3.02l-6.6 7.54L21.7 21h-6.07l-4.76-6.22L5.42 21H2.4l7.06-8.07L2.6 3h6.22l4.3 5.69L17.53 3Zm-1.06 16.17h1.67L7.6 4.74H5.81l10.66 14.43Z" />
      )}
    </svg>
  )
}

/* ────────────────────────────── a column the surface owns ─────────────────────────────────── */

/** One extra column of links, supplied by the surface rendering this footer. */
export interface FooterColumn {
  /** The column heading. An `<h2>`, exactly like the registry columns' own. */
  readonly title: string
  /**
   * Its links. **Absolute URLs**, the same as everything else in this footer.
   *
   * A relative path would work in the browser and break two things that are not the browser: the
   * link-reachability probe in `scripts/footer-audit.ts` resolves each `href` as a URL, and a
   * consumer that mounts this component on more than one origin would get a different destination
   * per origin without saying so. The one consumer that has its own pages — the marketing site —
   * resolves them against `cloudsforgeHosts().site`, which is how every other address here is
   * built.
   */
  readonly links: readonly { readonly href: string; readonly label: string }[]
}

export interface CloudsForgeFooterProps {
  /**
   * The surface this footer is being rendered on. Its own entry is marked `aria-current`, exactly
   * as the switcher marks it — a link that goes where you already are, announced as such.
   */
  current: SurfaceKey
  /**
   * The viewer, for `adminOnly` visibility. **Omitting it hides every operator surface**, which is
   * the safe default and the one a signed-out visitor gets. Only `roles` is read; this component
   * renders no account state of its own, because the bar already owns that.
   */
  account?: AccountState | undefined
  /** Override resolved surface URLs, exactly as the bar's `productUrls` does. */
  surfaceUrls?: Partial<Record<SurfaceKey, string>> | undefined
  /**
   * One sentence this surface wants to close with.
   *
   * This exists because four frontends had already written a footer and three of them contained
   * nothing but such a sentence — Foresight's "stakes go from your wallet to the market's contract
   * on Hearth", Market's "money on this surface is held by Forge Ledger", Status's "this page is
   * served independently of the systems it describes". Those are the honest, load-bearing part of
   * what this estate wanted a footer for, and centralising the chrome must not delete them. They
   * move here.
   */
  note?: ReactNode | undefined
  /**
   * Columns this surface adds, between the registry's and Legal.
   *
   * ── WHY THIS EXISTS, AND WHY IT IS NOT A WAY BACK TO NINETEEN FOOTERS ────────────────────────
   *
   * The marketing site is the reason. It carried a bespoke four-column footer until micro-org#489,
   * and one of those columns was not a restatement of anything this component knows: `/platform`,
   * `/build` and `/about` are PAGES OF THAT APPLICATION, they exist on no other surface, and the
   * only other place they are offered is a sticky header a reader has scrolled a long way past by
   * the time they reach a footer. Replacing that footer wholesale would have fixed the estate's
   * navigation by deleting the site's.
   *
   * So the surface may add columns and may not replace any. The registry columns, Legal, the
   * closing line and the socials are rendered whatever is passed here — there is no prop that
   * removes one — which is what keeps "one footer composed everywhere" true while letting a
   * surface with pages of its own say so. Nothing else in the estate passes this today, and a
   * second consumer would be a surface that genuinely has its own routes rather than a surface
   * that wants a different footer.
   */
  columns?: readonly FooterColumn[] | undefined
  /**
   * Rewrite the three Legal hrefs, which are composed here rather than passed in.
   *
   * ── WHY A FUNCTION, WHEN `surfaceUrls` IS A RECORD ────────────────────────────────────────────
   *
   * `surfaceUrls` is keyed by `SurfaceKey`, a closed union the registry owns, so a record cannot
   * go stale without a type error. `FOOTER_LEGAL_LINKS` is three paths on the marketing site and
   * nothing types them, so a record keyed by path would silently miss a FOURTH legal page the day
   * one is added — the exact drift `footer.test.ts` already guards against for the set itself.
   * A function is applied to every link there will ever be.
   *
   * ── WHAT ASKED FOR IT ─────────────────────────────────────────────────────────────────────────
   *
   * Forge Network (micro-org#484) renders one estate or the other and carries the reader's viewed
   * network on every link as `?net=`. It can wrap every surface link through `surfaceUrls`, and
   * these three were the only hrefs in this component it could not reach: a reader who had spent
   * the whole visit on testnet lost that the moment they opened the privacy notice, and came back
   * — via the site's own header — to mainnet. Reported rather than patched, which is why this is
   * here and not in a nineteenth bespoke footer.
   *
   * The default is identity: a surface that passes nothing gets `${hosts.site}${path}`, unchanged.
   */
  legalUrl?: ((url: string, path: string) => string) | undefined
}

/**
 * The company footer: the estate's navigation of last resort, on every surface.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * **EVERY LINK IN THE THREE NAVIGATION COLUMNS IS DERIVED FROM `SURFACES`. NONE IS TYPED HERE.**
 *
 * The label is `surface.name`, the address is `cloudsforgeHosts()[key]`, the column is decided by
 * `surface.kind`, whether it appears at all is `surface.servesUi`, and whether a signed-out reader
 * sees it is `surface.adminOnly`. There is no list of surfaces in this file. A seventh product is
 * a registry row and nothing else — which is the whole reason `surfaces.ts` exists, and this
 * component was written precisely because the estate had instead grown four hand-written footers,
 * nine surfaces with none, and a registry comment (`surfaces.ts`, the `developers` row: "Reached
 * from the footer, not the product switcher") describing a navigation path that did not exist.
 *
 * The three links that are NOT surfaces are in `FOOTER_LEGAL_LINKS` above, under their own
 * heading, with the reasoning for each absence written out.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ── `adminOnly` and the signed-out visitor ─────────────────────────────────────────────────────
 *
 * `admin` and `foresight-admin` are `adminOnly` and are omitted unless `account.roles` contains
 * `admin`, on the same rule and for the same reason as `resolveProducts`. **Hiding is not the
 * security boundary** — each service verifies the role on the token — but a footer is worse than a
 * switcher here: a switcher is a menu somebody opens, and a footer is on the page, so an
 * `adminOnly` entry rendered there advertises the operator console to every signed-out reader of
 * every product. The default is hidden: an app that passes no `account` gets the signed-out set.
 *
 * ── Accessibility ─────────────────────────────────────────────────────────────────────────────
 *
 * `role="contentinfo"` is stated rather than left implicit. It IS implicit for a `<footer>` that
 * is not inside a sectioning element, but that condition is a property of the CONSUMER's tree, not
 * of this file — a shell that one day wraps its outlet in a `<section>` would silently demote this
 * landmark to a generic group, and the guard that reads it would go quiet rather than red.
 *
 * Each column is a `<nav>` labelled by its own visible heading (`aria-labelledby`), so a screen
 * reader announces "Products navigation" rather than four unlabelled ones. Headings are `<h2>`:
 * every consuming page has an `<h1>`, and nothing between is skipped.
 *
 * Link text is always the surface's registry NAME — a full, meaningful phrase out of context,
 * which is the actual requirement behind "never write click here". Nothing here is a button, a
 * `div` with a handler, or an anchor without an `href`, so the whole footer is in the tab order by
 * construction rather than by an added `tabindex`.
 *
 * Colour is `--cf-*` tokens only; see `.cf-foot` in ui.css. There is no hex literal in this
 * component and none in its stylesheet.
 */
export function CloudsForgeFooter({
  current,
  account,
  surfaceUrls,
  note,
  columns,
  legalUrl,
}: CloudsForgeFooterProps) {
  const hosts = cloudsforgeHosts()
  const isAdmin = account?.roles?.includes('admin') ?? false
  const idBase = useId()

  // The surface being stood on, for the identity line. `surface()` throws on an unknown key rather
  // than resolving it to a URL, which is what we want: a typo must not render a footer at all.
  const here = surface(current)

  return (
    <footer className="cf-foot" role="contentinfo" aria-label="CloudsForge">
      <div className="cf-foot__inner">
        <div className="cf-foot__cols">
          {FOOTER_GROUPS.map((group) => {
            const visible = group.surfaces.filter((s) => isAdmin || !s.adminOnly)
            // A column that would render empty is not rendered: an <h2> over nothing is a
            // navigation landmark a reader can enter and find no links in.
            if (visible.length === 0) return null
            const headingId = `${idBase}-${group.kind}`
            return (
              <nav className="cf-foot__col" key={group.kind} aria-labelledby={headingId}>
                <h2 className="cf-foot__title" id={headingId}>
                  {group.title}
                </h2>
                <ul className="cf-foot__list">
                  {visible.map((s) => (
                    <li key={s.key}>
                      <a
                        className="cf-foot__link"
                        href={surfaceUrls?.[s.key] ?? hosts[s.key]}
                        aria-current={s.key === current ? 'page' : undefined}
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )
          })}

          {/*
            The surface's own pages, if it has any. Between the registry and Legal because that is
            where they belong in a reader's model of the page: everything to the left is somewhere
            else in the estate, everything to the right is the small print, and this is the site
            they are standing on.
          */}
          {columns?.map((column, i) => {
            const headingId = `${idBase}-own-${i}`
            return (
              <nav className="cf-foot__col" key={column.title} aria-labelledby={headingId}>
                <h2 className="cf-foot__title" id={headingId}>
                  {column.title}
                </h2>
                <ul className="cf-foot__list">
                  {column.links.map((l) => (
                    <li key={l.href}>
                      <a className="cf-foot__link" href={l.href}>
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )
          })}

          <nav className="cf-foot__col" aria-labelledby={`${idBase}-legal`}>
            <h2 className="cf-foot__title" id={`${idBase}-legal`}>
              Legal
            </h2>
            <ul className="cf-foot__list">
              {FOOTER_LEGAL_LINKS.map((l) => {
                // Not a surface. A route on the marketing site — see FOOTER_LEGAL_LINKS. The
                // composed address is what `legalUrl` is handed, so a consumer decorates an
                // absolute URL rather than rebuilding one out of a host it had to guess.
                const href = `${hosts.site}${l.path}`
                return (
                  <li key={l.path}>
                    <a className="cf-foot__link" href={legalUrl ? legalUrl(href, l.path) : href}>
                      {l.label}
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        {note && <p className="cf-foot__note">{note}</p>}

        <div className="cf-foot__base">
          <span className="cf-foot__brand">
            <CloudsForgeLogo size={16} />
          </span>
          {/* The surface's own name and blurb, from the registry. Not a tagline written here. */}
          <span className="cf-foot__here">
            {here.name} — {here.blurb}
          </span>

          {/*
            ── THE SOCIALS GO IN THE CLOSING LINE, NOT IN A COLUMN OF THEIR OWN ──────────────────

            Two links do not make a navigation landmark. A fifth `<nav>` headed "Follow" over two
            icons would add a landmark a screen-reader reader enters expecting a section and leaves
            immediately, and it would sit at the same visual weight as "Products" — nine links to
            the things this estate actually is. They belong on the identity line instead, beside
            the mark and the name of the surface: that row already answers "whose site is this",
            and "and where else are they" is the same question.

            It is a `<ul>` because it is a list of two and a screen reader should say so before
            reading them, which is the one piece of structure an icon row genuinely needs.

            `rel="me noopener"`. `me` is the half that does something a reader can check — it is the
            IndieWeb/`rel-me` assertion that the account at the other end is the same identity as
            this site, and it is what makes a verified link back from a profile mean anything.
            `noopener` is the half that matters if either ever opens in a new context: without it
            the opened document gets a live `window.opener` handle on this one.

            There is no `target="_blank"`. Opening a new tab is a decision about somebody else's
            browser, and a reader who wants one has a modifier key and a middle button; a footer
            that takes that choice away is the same category of thing as a banner that will not
            close.
          */}
          <ul className="cf-foot__social">
            {FOOTER_SOCIAL_LINKS.map((s) => (
              <li key={s.key}>
                <a className="cf-foot__sociallink" href={s.href} rel="me noopener">
                  <SocialMark mark={s.key} />
                  {/* The name, as real text. See `FooterSocialLink.label` for why not aria-label. */}
                  <span className="cf-sr">{s.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

/* ========================= SignInIntent ====================== */

/** One thing a signed-out reader can do on this surface, right now, and where. */
export interface SignInIntentAction {
  readonly label: string
  /**
   * An address ON THIS SURFACE. Relative, and that is not a style preference — see the note on
   * `SignInIntent` for why an off-surface "alternative" is the defect this component exists to
   * stop rather than a way round it.
   */
  readonly href: string
}

/**
 * What a reader without an account is offered instead. Exactly one of the two, enforced by the
 * type, because the third possibility — saying nothing — is the one that shipped.
 */
export type SignInIntentAlternatives =
  | {
      /** At least one. A one-element tuple is the smallest honest answer; zero is not an answer. */
      readonly actions: readonly [SignInIntentAction, ...SignInIntentAction[]]
      readonly nothing?: never
    }
  | {
      /**
       * The surface's own sentence for "there is genuinely nothing here without an account".
       * A real state on several surfaces, and a legitimate one — what is not legitimate is
       * leaving the reader to work it out from an empty list.
       */
      readonly nothing: string
      readonly actions?: never
    }

export interface SignInIntentProps {
  /** Which surface the reader is standing on. The NAME comes from the registry, never typed. */
  readonly surface: SurfaceKey
  /**
   * What a session unlocks HERE, in this surface's own words. At least one — the tuple type is
   * what makes "sign in to continue", which says nothing, fail to compile.
   */
  readonly unlocks: readonly [string, ...string[]]
  /** What the reader can do without one. See {@link SignInIntentAlternatives}. */
  readonly without: SignInIntentAlternatives
  /** Where the portal returns to. Defaults to the address the reader is on. */
  readonly returnUrl?: string | undefined
  /**
   * Called instead of {@link signInRedirect}, for a surface that owns its own hand-off — and for
   * the tests, which must be able to prove the button is wired without navigating the harness.
   */
  readonly onSignIn?: ((returnUrl?: string) => void) | undefined
}

/**
 * The panel a signed-out reader meets before anything sends them to another hostname.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT REPLACES, AND WHY THAT WAS NOT A BROKEN LINK
 *
 * `signInRedirect()` above is an immediate `window.location.assign`. Eleven repositories carry the
 * identical template-copied call site — `<LoadingGate label="Taking you to sign in" />` in
 * `src/lib/auth.tsx` — and six of them are PUBLIC FRONT DOORS, the first page a stranger sees.
 * The destination works. Nothing 404s. The defect is that six independently written landing pages
 * each end by throwing the reader at a hostname they have not been introduced to, before any of
 * them has said what an account is for.
 *
 * A spinner captioned "Taking you to sign in" is the worst available answer to "why?", because it
 * reads as progress. The reader has no way to tell an intentional hand-off from a page that has
 * decided they are not welcome, and by the time they could ask, the address bar has changed.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FOUR THINGS IT SAYS, IN ORDER
 *
 *   1. WHICH SURFACE. From `surface(key).name` in the registry — the same string the switcher, the
 *      footer and every `<title>` use. A surface cannot rename itself in this panel alone.
 *   2. WHAT AN ACCOUNT UNLOCKS HERE. Supplied by the surface, because only the surface knows. The
 *      prop is a non-empty tuple, so a caller cannot compile a panel that asks for a session and
 *      declines to say what for.
 *   3. WHAT THE READER CAN STILL DO WITHOUT ONE. Also required, also by the type: either at least
 *      one in-surface address, or an explicit sentence saying there is nothing. The list is the
 *      part that makes this a decision rather than a toll gate.
 *   4. WHERE THEY ARE ABOUT TO BE SENT. The sign-in host, resolved by `accountUrl()` from
 *      `window.location.hostname` at render time. It is named BEFORE the button rather than
 *      discovered in the address bar afterwards, and it is never typed here — the same bundle is
 *      served from localhost, a preview host and mainnet, and this string has to follow.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IT DOES NOT REDIRECT BY ITSELF, AND THAT IS THE CHANGE
 *
 * There is no effect, no timer and no `autoFocus`. Nothing navigates until the reader presses the
 * button. A countdown would have been the obvious compromise and it is refused twice over: it
 * invents a number nobody decided (rule 1.1 of 32-roadmap-ui-and-content applies to a constant
 * that moves a reader as much as to one that is printed at them), and a panel that explains itself
 * and then navigates anyway has not given the reader a choice, only a delay.
 *
 * A surface that genuinely must redirect immediately — a deep link into a gated page, where the
 * reader asked for something specific and the return address is the whole point — should keep
 * doing that. This panel is for the front door, which is where the six copies are.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * ACCESSIBILITY
 *
 * A `<section>` with an accessible name, not a dialog: nothing here is modal, nothing traps focus,
 * and the reader may ignore the panel and read the page. The two lists are real lists, so a screen
 * reader announces how many of each there are before reading them — which is the single most
 * useful fact about "what can I do without an account" and is exactly what a stack of `<div>`s
 * withholds. The button is a `<button>` and the alternatives are `<a href>`s, because one performs
 * an action and the others are destinations that can be opened in a new tab.
 */
export function SignInIntent({
  surface: key,
  unlocks,
  without,
  returnUrl,
  onSignIn,
}: SignInIntentProps) {
  const idBase = useId()
  const titleId = `${idBase}-title`

  // `surface()` throws on an unknown key rather than resolving it to something. A typo must fail
  // loudly here, not render a panel inviting somebody to sign in to a product that does not exist.
  const here = surface(key)

  // Resolved at render, from the hostname the reader is actually on. Never a literal: this package
  // is linked into sixteen bundles that are each served from localhost, a preview host and mainnet.
  const portal = new URL(accountUrl()).host

  const go = (): void => {
    if (onSignIn) onSignIn(returnUrl)
    else signInRedirect(returnUrl)
  }

  return (
    <section className="cf-signin" aria-labelledby={titleId}>
      <h2 className="cf-signin__title" id={titleId}>
        Sign in to {here.name}
      </h2>
      {/* The registry's one-line description of this surface, not a second tagline written here. */}
      <p className="cf-signin__blurb">{here.blurb}</p>

      {/*
        The two halves are SIDE BY SIDE where there is room, and the order is not decorative: what
        an account unlocks is the offer, what works without one is the answer to "and if I say no?".
        A reader who reads only the left column has still been told the truth; a reader who reads
        only the right one has not been sold anything.
      */}
      <div className="cf-signin__halves">
        <div className="cf-signin__half">
          <h3 className="cf-signin__heading">What an account gives you here</h3>
          <ul className="cf-signin__list">
            {unlocks.map((item) => (
              <li className="cf-signin__item" key={item}>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="cf-signin__half">
          <h3 className="cf-signin__heading">What you can do without one</h3>
          {without.actions ? (
            <ul className="cf-signin__list">
              {without.actions.map((action) => (
                <li className="cf-signin__item" key={action.href}>
                  <a className="cf-signin__link" href={action.href}>
                    {action.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            /*
              The named hole. A surface with nothing to offer a signed-out reader says so in its own
              words, in the place the list would have been — rather than rendering an empty list, or
              dropping the heading and leaving a reader to infer from an absence.
            */
            <p className="cf-signin__nothing">{without.nothing}</p>
          )}
        </div>
      </div>

      <div className="cf-signin__actions">
        <button type="button" className="cf-signin__go" onClick={go}>
          Sign in
        </button>
        {/*
          The destination, named before the button is pressed rather than discovered in the address
          bar after. `portal` is a host and not a full URL on purpose: the reader is being told
          which site they are about to be handed to, and a query string carrying their return
          address is noise in a sentence whose whole job is to be read.
        */}
        <p className="cf-signin__where">
          This takes you to <strong className="cf-signin__host">{portal}</strong> and brings you
          back here afterwards.
        </p>
      </div>
    </section>
  )
}
