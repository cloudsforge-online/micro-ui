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
  KNOWN_SUBS,
  SURFACES,
  SWITCHER_SURFACES,
  type CloudsForgeSurface,
  type ProductKey,
  type SurfaceKey,
  type SwitcherKey,
} from './surfaces.ts'

export type { ProductKey, SurfaceKey, SwitcherKey, CloudsForgeSurface }
export {
  PRODUCTS,
  PRODUCT_ACCENTS,
  RETIRED_ACCENTS,
  SURFACES,
  SWITCHER_SURFACES,
  KNOWN_SUBS,
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
}

export interface CloudsForgeBarProps {
  current: SurfaceKey
  account: AccountState
  onSignIn?: (() => void) | undefined
  onSignOut?: (() => void) | undefined
  productUrls?: ProductUrls | undefined
  /** Optional content rendered just left of the account menu. */
  rightSlot?: ReactNode | undefined
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
 */
export function cloudsforgeHosts(): CloudsForgeHosts {
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  if (!host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return LOCAL_HOSTS
  }
  const parts = host.split('.')
  const first = parts[0] ?? ''
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
 * `identity/src/server.test.ts:890` asserts the 404s), and no repository in the estate serves the
 * `account.` hostname. So every `Sign in` button in the estate led to a page that has never
 * existed. The registry entry `signin` is the address that IS served — see its note in
 * surfaces.ts for why it rides on Hub rather than claiming a hostname of its own.
 */
export function accountUrl(): string {
  return cloudsforgeHosts().signin
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
 * code and `POST /auth/handoff/redeem` to spend one (`identity/src/server.ts:1076` and `:1084`,
 * with `/auth/handoff/redeem` in the throttle table at `:410`). Every SSO callback in the estate
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
  /** Mint a single-use, origin-bound hand-off code. `identity/src/server.ts:1076`. */
  handoff: '/auth/handoff',
  /** Spend one. `identity/src/server.ts:1084`. */
  handoffRedeem: '/auth/handoff/redeem',
} as const

/**
 * Mint an SSO hand-off code for `redirectOrigin`, using a session this surface already holds.
 *
 * Called by the sign-in surface once credentials have been accepted, and by nothing else: the
 * caller must present an access token, and identity refuses an origin that is not on
 * `IDENTITY_HANDOFF_ORIGINS` (`identity/src/handoff.ts:31-47`) rather than minting a code that
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
    // matches against the value the code was minted for (`identity/src/handoff.ts:73-86`).
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

export function AccountMenu({ account, onSignIn, onSignOut }: AccountMenuProps) {
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
            <button
              type="button"
              className="cf-menu__item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignIn?.()
              }}
            >
              <span className="cf-menu__icon" aria-hidden="true">
                ◇
              </span>
              <span className="cf-menu__text">
                <span className="cf-menu__name">Account</span>
              </span>
            </button>
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
        <AccountMenu account={account} onSignIn={onSignIn} onSignOut={onSignOut} />
      </div>
    </div>
  )
}
