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
export type { ProductKey, SurfaceKey, SwitcherKey, CloudsForgeSurface };
export { PRODUCTS, PRODUCT_ACCENTS, RETIRED_ACCENTS, SURFACES, SWITCHER_SURFACES, KNOWN_SUBS, surface, CLOUDSFORGE_EMBER, type SurfaceKind, } from './surfaces.ts';
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
}
export interface AccountMenuProps {
    account: AccountState;
    onSignIn?: (() => void) | undefined;
    onSignOut?: (() => void) | undefined;
}
export interface CloudsForgeBarProps {
    current: SurfaceKey;
    account: AccountState;
    onSignIn?: (() => void) | undefined;
    onSignOut?: (() => void) | undefined;
    productUrls?: ProductUrls | undefined;
    /** Optional content rendered just left of the account menu. */
    rightSlot?: ReactNode | undefined;
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
export declare function cloudsforgeHosts(): CloudsForgeHosts;
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
export declare function accountUrl(): string;
/**
 * Redirect the browser to the Account portal to sign in. After a successful login the portal
 * returns to `returnUrl` with a one-time hand-off code in the URL hash (`#cf_code=…`) — redeem it
 * on boot with {@link consumeAuthCallback}. Defaults to returning to the current page.
 */
export declare function signInRedirect(returnUrl?: string): void;
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
export declare const IDENTITY_AUTH_ROUTES: {
    /** Mint a single-use, origin-bound hand-off code. `identity/src/server.ts:1076`. */
    readonly handoff: "/auth/handoff";
    /** Spend one. `identity/src/server.ts:1084`. */
    readonly handoffRedeem: "/auth/handoff/redeem";
};
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
export declare function mintHandoffCode(accessToken: string, redirectOrigin: string): Promise<string | null>;
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
 */
export declare function resolveProducts(productUrls?: ProductUrls, isAdmin?: boolean): CloudsForgeProduct[];
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
export declare function ProductSwitcher({ current, productUrls, isAdmin }: ProductSwitcherProps): import("react").JSX.Element;
export declare function AccountMenu({ account, onSignIn, onSignOut }: AccountMenuProps): import("react").JSX.Element;
export declare function CloudsForgeBar({ current, account, onSignIn, onSignOut, productUrls, rightSlot, }: CloudsForgeBarProps): import("react").JSX.Element;
