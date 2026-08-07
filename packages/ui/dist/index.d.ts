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
export { FOOTER_GROUPS, FOOTER_SURFACES, PRODUCTS, PRODUCT_ACCENTS, RETIRED_ACCENTS, SURFACES, SWITCHER_SURFACES, ENV_LABELS, KNOWN_SUBS, envLabel, splitEnvLabel, surface, CLOUDSFORGE_EMBER, type SurfaceKind, } from './surfaces.ts';
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
export declare function AccountMenu({ account, onSignIn, onSignOut, accountHref }: AccountMenuProps): import("react").JSX.Element;
export declare function CloudsForgeBar({ current, account, onSignIn, onSignOut, productUrls, rightSlot, accountHref, }: CloudsForgeBarProps): import("react").JSX.Element;
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
export declare function CloudsForgeFooter({ current, account, surfaceUrls, note, }: CloudsForgeFooterProps): import("react").JSX.Element;
