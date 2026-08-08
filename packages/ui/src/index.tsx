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
  envLabel,
  splitEnvLabel,
  surface,
  type CloudsForgeSurface,
  type ProductKey,
  type SurfaceKey,
  type SwitcherKey,
} from './surfaces.ts'

import {
  analyticsAllowedHere,
  analyticsId,
  denyConsent,
  grantConsent,
  onConsentChange,
  readConsent,
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
  ENV_LABELS,
  KNOWN_SUBS,
  envLabel,
  splitEnvLabel,
  surface,
  CLOUDSFORGE_EMBER,
  type SurfaceKind,
} from './surfaces.ts'

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
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
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

/**
 * Redirect the browser to the Account portal to sign out (clearing the shared portal session and
 * revoking the refresh token), then return to `returnUrl`. Clear this app's own local tokens
 * first: the portal cannot reach them.
 */
export function signOutRedirect(returnUrl?: string): void {
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
 * Mint an SSO hand-off code for `redirectOrigin`, using a session this surface already holds.
 *
 * Called by the sign-in surface once credentials have been accepted, and by nothing else: the
 * caller must present an access token, and identity refuses an origin that is not on
 * `IDENTITY_HANDOFF_ORIGINS` (`identity/src/handoff.ts`) rather than minting a code that
 * could not be redeemed. `redirectOrigin` is an ORIGIN — scheme, host and port, no path — because
 * that is what a browser puts in the `Origin` header of the redemption POST, and the two are
 * compared for equality when the code is spent.
 *
 * Returns null on any refusal. There is nothing useful for a caller to do with the distinction
 * between "that origin is not allowed" and "that token is not valid", and both mean the same
 * thing on screen: this hand-off cannot be completed, sign in on the destination instead.
 */
export async function mintHandoffCode(
  accessToken: string,
  redirectOrigin: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${cloudsforgeHosts().nimbus}${IDENTITY_AUTH_ROUTES.handoff}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ redirectOrigin }),
    })
    if (!res.ok) return null
    const body: unknown = await res.json()
    const code = (body as { code?: unknown } | null)?.code
    return typeof code === 'string' && code.length > 0 ? code : null
  } catch {
    return null
  }
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
    return readCallbackTokens(body)
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
 */
export function resolveProducts(productUrls?: ProductUrls, isAdmin = false): CloudsForgeProduct[] {
  const hosts = cloudsforgeHosts()
  return SWITCHER_SURFACES.filter((p) => isAdmin || !p.adminOnly).map((p) => {
    const key = p.key as SwitcherKey
    return {
      key,
      label: p.name,
      blurb: p.blurb,
      glyph: p.glyph,
      accent: p.accent,
      url: productUrls?.[key] ?? hosts[p.key],
      ...(p.adminOnly ? { adminOnly: true as const } : {}),
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
export function ProductSwitcher({ current, productUrls, isAdmin = false }: ProductSwitcherProps) {
  const { open, setOpen, rootRef, triggerRef } = useDropdown()
  const products = resolveProducts(productUrls, isAdmin)
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
                      <span className="cf-menu__name">{p.label}</span>
                      <span className="cf-menu__blurb">{p.blurb}</span>
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
        <ProductSwitcher current={current} productUrls={productUrls} isAdmin={isAdmin} />
        <span className="cf-bar__spacer" />
        {rightSlot && <div className="cf-bar__right">{rightSlot}</div>}
        <AccountMenu
          account={account}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          {...(accountHref === undefined ? {} : { accountHref })}
        />
      </div>
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
  if (decision !== null || id === null) return null

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
            answer once for the whole of CloudsForge, and you can change your mind at any time.{' '}
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

          <nav className="cf-foot__col" aria-labelledby={`${idBase}-legal`}>
            <h2 className="cf-foot__title" id={`${idBase}-legal`}>
              Legal
            </h2>
            <ul className="cf-foot__list">
              {FOOTER_LEGAL_LINKS.map((l) => (
                <li key={l.path}>
                  {/* Not a surface. A route on the marketing site — see FOOTER_LEGAL_LINKS. */}
                  <a className="cf-foot__link" href={`${hosts.site}${l.path}`}>
                    {l.label}
                  </a>
                </li>
              ))}
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
