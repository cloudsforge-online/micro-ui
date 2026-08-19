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
import { type ReactNode } from 'react';
import { type CloudsForgeSurface, type ProductKey, type SurfaceKey, type SwitcherKey } from './surfaces.ts';
import { type MiningControlProps } from './mining.tsx';
import { type ConsentDecision } from './consent.ts';
export type { ProductKey, SurfaceKey, SwitcherKey, CloudsForgeSurface };
/**
 * The four cross-cutting concerns, re-exported from the root so a surface adopts them with one
 * import rather than four. Each has its own subpath as well (`@cloudsforge/ui/seo`,
 * `/sitemap`, `/consent`) for the callers that are not React — a build script generating a
 * sitemap has no business pulling in a rendering library.
 */
export { ANALYTICS_META_NAME, CONSENT_COOKIE_NAME, CONSENT_EVENT, CONSENT_MAX_AGE_SECONDS, CONSENT_STORAGE_KEY, analyticsAllowedHere, analyticsId, clearConsent, consentCookieDomains, deleteAnalyticsCookies, denyConsent, grantConsent, initAnalytics, initConsentDefaults, onConsentChange, readConsent, revokeConsent, writeConsent, type ConsentDecision, } from './consent.ts';
export { COMPANY_LINE, DEFAULT_OG_IMAGE, HTML_LANG, INDEXABLE_SURFACES, SITE_NAME, applyHead, canonicalHref, descriptionFor, metaTags, normalisePath, robotsDirective, surfaceMeta, type MetaTag, type PageMetaInput, type SurfaceMeta, type TagKind, } from './seo.ts';
export { SITEMAP_SURFACES, robotsTxt, sitemapUrls, sitemapXml, type SitemapUrl, } from './sitemap.ts';
export { FOOTER_GROUPS, FOOTER_SURFACES, PRODUCTS, PRODUCT_ACCENTS, RETIRED_ACCENTS, SURFACES, SWITCHER_SURFACES, VIEWING_SURFACES, ENV_LABELS, KNOWN_SUBS, envLabel, splitEnvLabel, surface, CLOUDSFORGE_EMBER, type SurfaceKind, } from './surfaces.ts';
/**
 * The browser mining control. Re-exported from the root rather than given its own subpath: it is
 * React and it belongs in the bar, so every caller that can use it is already importing from here.
 */
export { EMBER_CREDITED_CLAUSE, HUB_MINE_PATH, MiningControl, NOT_PAID_CLAUSE, formatHashrate, miningOnHub, type MiningControlProps, type MiningPhase, type MiningReadout, type MiningSubject, } from './mining.tsx';
/** A single switcher entry, resolved for the current environment. */
export interface CloudsForgeProduct {
    key: SwitcherKey;
    label: string;
    blurb: string;
    glyph: string;
    accent: string;
    url: string;
    /** Hidden from the switcher unless the viewer holds the `admin` role. */
    adminOnly?: boolean;
    /**
     * The registry's `incomplete` sentence, when the surface has one: a person can open this and
     * the thing it is named after is switched off. Carried through rather than dropped because the
     * switcher is where the click starts, and a warning that arrives on the far side of a
     * navigation has already failed.
     */
    incomplete?: string;
    /**
     * The network this entry will show, set ONLY when the reader is viewing a different one and this
     * surface's bundle cannot follow them (no `viewsAnyNetwork` on its registry row).
     *
     * The same argument as `incomplete` one field up, applied to a different fact: the switcher is
     * where the click starts. Leaving it unmarked is what the owner reported — the choice vanished
     * on arrival with nothing having said it would — and marking it on the far side would be a
     * notice about a navigation that has already happened.
     */
    pinnedNetwork?: 'mainnet' | 'testnet';
}
/** Optional override map for surface URLs (e.g. production hosts from env). */
export type ProductUrls = Partial<Record<SwitcherKey, string>>;
/** The viewer's account state for the shared bar. */
export interface AccountState {
    signedIn: boolean;
    handle?: string | null;
    /**
     * The viewer's roles, straight from the Nimbus token claims. Only used to decide whether
     * operator-only surfaces appear in the switcher — omitting it simply hides them, so an app that
     * does not pass it stays correct.
     */
    roles?: readonly string[] | null;
}
export interface CloudsForgeLogoProps {
    /** Pixel height of the emblem mark. Defaults to 20. */
    size?: number | undefined;
    /** Hide the "CloudsForge" wordmark, showing only the mark. */
    markOnly?: boolean | undefined;
}
export interface ProductSwitcherProps {
    /**
     * The surface currently being viewed, marked as active in the menu. Typed as a full
     * `SurfaceKey` rather than a switcher key because Hub and the marketing site render the bar
     * without appearing in it; they simply mark nothing active.
     */
    current: SurfaceKey;
    /** Override the resolved surface URLs. */
    productUrls?: ProductUrls | undefined;
    /** Reveals operator-only surfaces. Defaults to hidden. */
    isAdmin?: boolean | undefined;
    /**
     * The network the reader is looking at, when it is not the one this page is served from.
     *
     * Passed by {@link CloudsForgeBar} from `networkSwitch.selected`, so a surface that already
     * declares its in-app network context gets this for free and one that does not is unchanged.
     * Every entry that can follow the reader is linked WITH the choice; every entry that cannot is
     * marked as staying behind. See {@link resolveProducts}.
     */
    viewedNetwork?: 'mainnet' | 'testnet' | undefined;
}
export interface AccountMenuProps {
    account: AccountState;
    onSignIn?: (() => void) | undefined;
    onSignOut?: (() => void) | undefined;
    /**
     * Where the `Account` entry goes. Defaults to {@link accountSettingsUrl}.
     *
     * For a surface that serves its own account screen and would rather keep the reader on it than
     * send them across to Hub. It is an ADDRESS, not a callback, on purpose — see the note on
     * `accountSettingsUrl`.
     */
    accountHref?: string | undefined;
}
export interface CloudsForgeBarProps {
    current: SurfaceKey;
    account: AccountState;
    onSignIn?: (() => void) | undefined;
    onSignOut?: (() => void) | undefined;
    productUrls?: ProductUrls | undefined;
    /** Optional content rendered just left of the account menu. */
    rightSlot?: ReactNode | undefined;
    /** Passed through to {@link AccountMenu}. Defaults to {@link accountSettingsUrl}. */
    accountHref?: string | undefined;
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
    mining?: MiningControlProps | undefined;
    /**
     * Stage-3 surfaces (read-only) pass {@link NetworkSwitcherProps} to switch data in place;
     * everything else omits this and the switcher navigates to the sibling hostname
     * (micro-org#459 — a money action must never silently target a network the address bar does
     * not name).
     */
    networkSwitch?: NetworkSwitcherProps | undefined;
}
/**
 * Every CloudsForge surface's base URL, resolved for the current environment.
 *
 * Derived from the registry rather than declared: this module exists to end hand-maintained
 * lists, and the version it replaces restated all fourteen keys three times over. A new surface
 * is a registry entry and nothing else.
 */
export type CloudsForgeHosts = Record<SurfaceKey, string>;
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
export declare function apiBaseFor(pageOrigin: string, hosts: CloudsForgeHosts, key: SurfaceKey): string;
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
export declare function cloudsforgeHosts(): CloudsForgeHosts;
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
export declare function accountUrl(): string;
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
export declare function accountSettingsUrl(): string;
/**
 * Redirect the browser to the Account portal to sign in. After a successful login the portal
 * returns to `returnUrl` with a one-time hand-off code in the URL hash (`#cf_code=…`) — redeem it
 * on boot with {@link consumeAuthCallback}. Defaults to returning to the current page.
 */
export declare function signInRedirect(returnUrl?: string): void;
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
export declare function rememberSignedIn(): void;
/** Forget it: a sign-out anywhere, or a probe the portal answered `none`. */
export declare function forgetSignedIn(): void;
/** Is there a hint that this browser has a portal session? */
export declare function hasSignedInHint(): boolean;
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
export declare function attemptSilentSignIn(hasLocalSession: boolean): boolean;
/**
 * Redirect the browser to the Account portal to sign out (clearing the shared portal session and
 * revoking the refresh token), then return to `returnUrl`. Clear this app's own local tokens
 * first: the portal cannot reach them.
 */
export declare function signOutRedirect(returnUrl?: string): void;
/** Tokens issued to this app after redeeming the portal's hand-off code. */
export interface AuthCallbackTokens {
    accessToken: string;
    refreshToken: string;
    /** Lifetime of the access token in seconds, as identity reports it. */
    expiresIn?: number;
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
export declare const IDENTITY_AUTH_ROUTES: {
    /** Mint a single-use, origin-bound hand-off code. `identity/src/server.ts`. */
    readonly handoff: "/auth/handoff";
    /** Spend one. `identity/src/server.ts`. */
    readonly handoffRedeem: "/auth/handoff/redeem";
};
/**
 * The one error code for which "ask an operator to add this origin to the allowlist" is true.
 *
 * Restated from `identity/src/handoff.ts`, which exports it under
 * `HANDOFF_ORIGIN_REFUSED_CODE` and is the source of record. It is restated rather than imported
 * for the same reason `IDENTITY_AUTH_ROUTES` above restates two paths: this package may not depend
 * on a service. The difference from the routes is that a drifted value here is SAFE — an unknown
 * code falls through to `'refused'`, which is the old behaviour — whereas a drifted route 404s.
 */
export declare const HANDOFF_ORIGIN_REFUSED = "handoff_origin_refused";
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
export type HandoffRefusal = 'origin' | 'session' | 'unreachable' | 'refused';
/** What `POST /auth/handoff` answered, refusals included. */
export type HandoffMint = {
    readonly ok: true;
    readonly code: string;
} | {
    readonly ok: false;
    readonly refusal: HandoffRefusal;
    /** The HTTP status, or 0 when the request never got an answer. */
    readonly status: number;
    /** identity's own error code, when it sent one and it was readable. */
    readonly errorCode: string | null;
};
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
    refresh?: (() => Promise<string | null | undefined>) | undefined;
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
export declare function mintHandoff(accessToken: string, redirectOrigin: string, options?: MintHandoffOptions): Promise<HandoffMint>;
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
export declare function mintHandoffCode(accessToken: string, redirectOrigin: string, options?: MintHandoffOptions): Promise<string | null>;
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
export declare function handoffReturnUrl(returnUrl: string, code: string): string;
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
export declare function consumeAuthCallback(): Promise<AuthCallbackTokens | null>;
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
export declare function resolveProducts(productUrls?: ProductUrls, isAdmin?: boolean, viewedNetwork?: 'mainnet' | 'testnet'): CloudsForgeProduct[];
export interface MarkProps {
    /** Which surface's mark to draw. A surface with no mark of its own renders nothing. */
    surface: SurfaceKey;
    /** Pixel size. Tested at 16, 24 and 32; below 16 the ridge stops reading. */
    size?: number;
    /**
     * Force the accent, for the case the switcher has: five marks on one page, each needing its
     * OWN product's colour rather than the colour of the page they are listed on.
     */
    accent?: string;
    /** Accessible name. Defaults to the surface's registry name. */
    title?: string;
    className?: string;
}
/** True when {@link Mark} will draw something for this surface. */
export declare function hasMark(key: SurfaceKey): boolean;
export declare function Mark({ surface: key, size, accent, title, className }: MarkProps): import("react").JSX.Element | null;
/**
 * The CloudsForge emblem: an ember spark cresting an anvil-ash ridge. Pure inline SVG — no image
 * request, no external asset, no flash of a missing logo on a cold cache.
 */
export declare function CloudsForgeLogo({ size, markOnly }: CloudsForgeLogoProps): import("react").JSX.Element;
/**
 * The product switcher.
 *
 * Each entry carries a mark, a name and a blurb as well as its accent, because colour is never
 * the only channel: a reader who cannot separate two hues still has three other ways to tell two
 * entries apart. The operator tools render below a separator, which is also what keeps their
 * accents from ever being adjacent to a product's.
 */
export declare function ProductSwitcher({ current, productUrls, isAdmin, viewedNetwork, }: ProductSwitcherProps): import("react").JSX.Element;
export declare function AccountMenu({ account, onSignIn, onSignOut, accountHref }: AccountMenuProps): import("react").JSX.Element;
export declare function CloudsForgeBar({ current, account, onSignIn, onSignOut, productUrls, rightSlot, accountHref, mining, networkSwitch, }: CloudsForgeBarProps): import("react").JSX.Element;
/**
 * Which network is this page being served FOR — 'mainnet', 'testnet', or null when the question
 * has no answer (localhost, a bare IP, an unrecognised host). Read from the hostname, because on
 * every surface the hostname IS the network: that is the estate's addressing scheme, and it is
 * why this needs no configuration and cannot drift from where the reader actually is.
 */
export declare function currentNetwork(): 'mainnet' | 'testnet' | null;
export declare const NETWORK_QUERY_PARAM = "net";
/**
 * The network named in a URL's query, or null when it names none or names nonsense.
 *
 * Null rather than a default on an unrecognised value: `?net=maiinet` is a typo or a probe, and
 * the honest reading is "this URL says nothing", which leaves the bundle on the hostname's own
 * network. Defaulting a bad value to mainnet would be the same answer by accident, and defaulting
 * it to testnet would let a malformed link change what a page shows.
 */
export declare function networkFromQuery(search?: string): 'mainnet' | 'testnet' | null;
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
export declare function withNetwork(url: string, network: 'mainnet' | 'testnet'): string;
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
export declare function siblingNetworkUrl(target: 'mainnet' | 'testnet'): string | null;
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
export declare function viewingSurfaceUrl(current: SurfaceKey, target: 'mainnet' | 'testnet', productUrls?: ProductUrls): string | null;
export interface NetworkSwitcherProps {
    /**
     * Where to send a reader who picks a network this surface cannot show. Supplied by
     * {@link CloudsForgeBar} from the registry; see {@link viewingSurfaceUrl}.
     *
     * Set, and the inactive option is a LINK to a surface that can show that network, labelled so
     * the reader knows they are leaving before they click. Unset — which is what a surface that
     * passes `onSelect` gets, because it needs no escape — and nothing changes.
     */
    elsewhere?: string | undefined;
    /**
     * Stage-3 surfaces (read-only: explorer, network-site, pool-web) pass this to switch the DATA
     * in place instead of navigating. Absent — the default, and the permanent behaviour of every
     * surface with a write path — choosing the other network NAVIGATES to the sibling hostname.
     */
    onSelect?: ((network: 'mainnet' | 'testnet') => void) | undefined;
    /** Overrides the highlighted network. Only meaningful with `onSelect` (in-place surfaces). */
    selected?: 'mainnet' | 'testnet' | undefined;
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
export declare function NetworkSwitcher({ onSelect, selected, elsewhere }: NetworkSwitcherProps): import("react").JSX.Element | null;
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
export declare function networkOrigin(target: 'mainnet' | 'testnet'): string;
/**
 * The network the reader has CHOSEN in this tab — the stage-3 sessionStorage choice when one
 * exists, the hostname's network otherwise. The non-React read, for API layers that compute a
 * base URL outside the component tree.
 */
export declare function chosenNetwork(): 'mainnet' | 'testnet';
/**
 * The reader's chosen network, held per tab and offered to the bar.
 *
 * sessionStorage rather than localStorage, deliberately: a persisted choice would make a reader
 * who explored testnet LAST WEEK open the explorer today onto testnet data under a mainnet
 * address bar, which is the confusion this whole design exists to prevent. A tab's choice dies
 * with the tab; every fresh tab starts on the network the hostname names.
 */
export declare function useNetworkChoice(): {
    network: 'mainnet' | 'testnet';
    switcher: NetworkSwitcherProps;
};
/**
 * The band that makes testnet unmistakable. Rendered by the bar whenever the page IS testnet —
 * a unified experience makes being on the wrong network easier, and the defence is that the wrong
 * network never looks like the right one. Not dismissible, on purpose: a dismissed warning is a
 * warning that was shown once, and this one has to hold for the whole session.
 */
export declare function TestnetBand({ network }?: {
    network?: 'mainnet' | 'testnet' | undefined;
}): import("react").JSX.Element | null;
export interface SkipLinkProps {
    /**
     * The `id` of the element focus should land on. Defaults to `main`, which is also the id
     * {@link MAIN_ID} names — use that constant on the `<main>` so the two cannot disagree.
     */
    targetId?: string | undefined;
    /** The visible text. Defaults to "Skip to content". */
    children?: ReactNode | undefined;
}
/**
 * The id the skip link points at, and the id a surface must put on its `<main>`.
 *
 * Named rather than typed twice: a skip link whose target does not exist is a link that moves the
 * address bar and nothing else, and it is invisible to everything except a person using it.
 */
export declare const MAIN_ID = "cf-main";
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
export declare function SkipLink({ targetId, children }: SkipLinkProps): import("react").JSX.Element;
export interface MainRegionProps {
    id?: string | undefined;
    className?: string | undefined;
    children: ReactNode;
}
/**
 * The `<main>` landmark, focusable, so {@link SkipLink} actually moves focus into it.
 *
 * Optional — a surface with its own `<main>` keeps it and adds `id={MAIN_ID} tabIndex={-1}`. This
 * exists so that the common case cannot get the two attributes wrong, and so that "every surface
 * has exactly one `main` landmark" is something a browser test can assert by name.
 */
export declare function MainRegion({ id, className, children }: MainRegionProps): import("react").JSX.Element;
export interface SubNavProps {
    /**
     * What a screen reader hears when it lands on the landmark. Required, and deliberately not
     * defaulted to "Sections": a document with two `<nav>` elements — the bar is one — announces
     * both, and two landmarks called "Navigation" are two landmarks nobody can tell apart.
     */
    label: string;
    /**
     * The links. Each one should carry `className="cf-subnav__link"` and, when it is the address
     * being read, `cf-subnav__link--current`.
     *
     * The markup is the caller's because the routing is: every surface here uses react-router's
     * `NavLink`, which owns the active state, and this package does not depend on react-router. What
     * is shared is the STRIP — the sticky offset, the scroll behaviour and the measure — which is
     * the part that drifted.
     */
    children: ReactNode;
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
export declare function SubNav({ label, children }: SubNavProps): import("react").JSX.Element;
export type StatusLevel = 'good' | 'warn' | 'critical' | 'neutral';
export interface StatusPillProps {
    level: StatusLevel;
    /** The word. Never optional — it is the accessible content, not a caption. */
    children: ReactNode;
    /** Overrides the default glyph. Always `aria-hidden`; the word carries the meaning. */
    glyph?: string | undefined;
    /**
     * Announce changes to assistive technology as they happen. Set it on a pill whose level changes
     * without a navigation — a probe going red, a withdrawal settling — and leave it off for a pill
     * that merely describes a row in a table, where twelve live regions would be twelve
     * interruptions.
     */
    live?: boolean | undefined;
    className?: string | undefined;
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
export declare function StatusPill({ level, children, glyph, live, className }: StatusPillProps): import("react").JSX.Element;
export interface CookieBannerProps {
    /**
     * Where "how we use cookies" goes. Defaults to the privacy notice on the marketing site, which
     * is the page that actually describes the processing.
     */
    privacyHref?: string | undefined;
    /** Called after either button, with the decision. For a surface that wants to react to it. */
    onDecide?: ((decision: ConsentDecision) => void) | undefined;
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
export declare const CONSENT_CHOICES_LABEL = "Cookie choices";
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
export declare function ConsentChoices(): import("react").JSX.Element;
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
export declare function CookieBanner({ privacyHref, onDecide }: CookieBannerProps): import("react").JSX.Element | null;
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
export declare const FOOTER_LEGAL_LINKS: readonly {
    readonly path: string;
    readonly label: string;
}[];
/** One account this project publishes under, somewhere that is not this estate. */
export interface FooterSocialLink {
    /** Which mark to draw. A closed union, because each one is a hand-written path below. */
    readonly key: 'github' | 'x';
    /** The profile. Absolute and external by definition — these are the two links that leave. */
    readonly href: string;
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
    readonly label: string;
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
export declare const FOOTER_SOCIAL_LINKS: readonly FooterSocialLink[];
/** One extra column of links, supplied by the surface rendering this footer. */
export interface FooterColumn {
    /** The column heading. An `<h2>`, exactly like the registry columns' own. */
    readonly title: string;
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
    readonly links: readonly {
        readonly href: string;
        readonly label: string;
    }[];
}
export interface CloudsForgeFooterProps {
    /**
     * The surface this footer is being rendered on. Its own entry is marked `aria-current`, exactly
     * as the switcher marks it — a link that goes where you already are, announced as such.
     */
    current: SurfaceKey;
    /**
     * The viewer, for `adminOnly` visibility. **Omitting it hides every operator surface**, which is
     * the safe default and the one a signed-out visitor gets. Only `roles` is read; this component
     * renders no account state of its own, because the bar already owns that.
     */
    account?: AccountState | undefined;
    /** Override resolved surface URLs, exactly as the bar's `productUrls` does. */
    surfaceUrls?: Partial<Record<SurfaceKey, string>> | undefined;
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
    note?: ReactNode | undefined;
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
    columns?: readonly FooterColumn[] | undefined;
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
    legalUrl?: ((url: string, path: string) => string) | undefined;
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
export declare function CloudsForgeFooter({ current, account, surfaceUrls, note, columns, legalUrl, }: CloudsForgeFooterProps): import("react").JSX.Element;
/** One thing a signed-out reader can do on this surface, right now, and where. */
export interface SignInIntentAction {
    readonly label: string;
    /**
     * An address ON THIS SURFACE. Relative, and that is not a style preference — see the note on
     * `SignInIntent` for why an off-surface "alternative" is the defect this component exists to
     * stop rather than a way round it.
     */
    readonly href: string;
}
/**
 * What a reader without an account is offered instead. Exactly one of the two, enforced by the
 * type, because the third possibility — saying nothing — is the one that shipped.
 */
export type SignInIntentAlternatives = {
    /** At least one. A one-element tuple is the smallest honest answer; zero is not an answer. */
    readonly actions: readonly [SignInIntentAction, ...SignInIntentAction[]];
    readonly nothing?: never;
} | {
    /**
     * The surface's own sentence for "there is genuinely nothing here without an account".
     * A real state on several surfaces, and a legitimate one — what is not legitimate is
     * leaving the reader to work it out from an empty list.
     */
    readonly nothing: string;
    readonly actions?: never;
};
export interface SignInIntentProps {
    /** Which surface the reader is standing on. The NAME comes from the registry, never typed. */
    readonly surface: SurfaceKey;
    /**
     * What a session unlocks HERE, in this surface's own words. At least one — the tuple type is
     * what makes "sign in to continue", which says nothing, fail to compile.
     */
    readonly unlocks: readonly [string, ...string[]];
    /** What the reader can do without one. See {@link SignInIntentAlternatives}. */
    readonly without: SignInIntentAlternatives;
    /** Where the portal returns to. Defaults to the address the reader is on. */
    readonly returnUrl?: string | undefined;
    /**
     * Called instead of {@link signInRedirect}, for a surface that owns its own hand-off — and for
     * the tests, which must be able to prove the button is wired without navigating the harness.
     */
    readonly onSignIn?: ((returnUrl?: string) => void) | undefined;
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
export declare function SignInIntent({ surface: key, unlocks, without, returnUrl, onSignIn, }: SignInIntentProps): import("react").JSX.Element;
