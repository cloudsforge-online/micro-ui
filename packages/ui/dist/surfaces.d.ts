/**
 * The CloudsForge surface registry — the single declaration of what a CloudsForge surface is.
 *
 * This module has NO dependencies, not even React, and is published as its own subpath
 * (`@cloudsforge/ui/surfaces`) so a build script, a gateway config generator or the asset
 * pipeline can read the registry without pulling in a rendering library.
 *
 * Before a registry existed the same list was maintained by hand in eight places — the switcher,
 * the identity portal (three times), a static portal page, the marketing site, the browser
 * observability client and the compose anchors — and they had already drifted apart. Anything
 * that needs a surface's name, colour, hostname, port or brand mark reads it from here.
 *
 * Specification: docs/ecosystem/assets/design-system.md sections 3 and 5.
 */
/** Surfaces a person chooses between: the six products. */
export type ProductKey = 'foresight' | 'network' | 'trade' | 'create' | 'market' | 'worlds';
/** Everything that may appear in the product switcher, products plus the operator tools. */
export type SwitcherKey = ProductKey | 'admin' | 'lantern' | 'beacon';
/** Every addressable CloudsForge surface, including the ones with no UI of their own. */
export type SurfaceKey = SwitcherKey | 'hub' | 'signin' | 'site' | 'emberkin' | 'aetherholm' | 'tessera' | 'wallet' | 'faucet' | 'developers' | 'status' | 'explorer' | 'nimbus' | 'account' | 'api' | 'pay' | 'keyvault' | 'rpc' | 'p2p';
/**
 * What a surface *is*, which decides where it may appear.
 *
 * - `product` — something a person chooses. Belongs in the switcher and on the marketing site.
 * - `surface` — a way into the platform itself: Hub, the front door, a route inside one of
 *               them. Never a product card, because an account is not a product.
 * - `service` — has a hostname; never a product card. It belongs in the switcher only when it
 *               is a tool an operator opens by hand — Admin, Lantern and Beacon are the three —
 *               and such a service is `adminOnly`, because a surface nobody but an operator can
 *               open has no business in a player's switcher.
 */
export type SurfaceKind = 'product' | 'surface' | 'service';
export interface CloudsForgeSurface {
    readonly key: SurfaceKey;
    /** The name a person reads. Always the surface's real name, never a category. */
    readonly name: string;
    /** The verb this surface owns in "mine it, trade it, make it, sell it, play in it". */
    readonly verb: string | null;
    readonly kind: SurfaceKind;
    /** Subdomain under the apex. An empty string means the apex itself. */
    readonly subdomain: string;
    /** Port on localhost, for `pnpm dev` and the local compose stack. */
    readonly devPort: number;
    /**
     * Set when this surface is a ROUTE on another surface's host rather than a host of its own —
     * `subdomain` and `devPort` then name the host it lives on, and the URL is that origin plus
     * this path.
     */
    readonly basePath?: string;
    /** The accent, from the validated set below. Never invented locally. */
    readonly accent: string;
    /** Switcher glyph. Present on every switcher entry, because colour is never the only channel. */
    readonly glyph: string;
    /** asset-forge id for this surface's brand mark, when it has one. */
    readonly markId: string | null;
    /** One line, shown under the name in the switcher and on product cards. */
    readonly blurb: string;
    /**
     * True when a PERSON can open this address in a browser and be served a page.
     *
     * ── Why this is a field rather than something inferred ────────────────────────────────────────
     *
     * `kind` does not answer it. `explorer` is a `service` and serves a full SPA; `beacon` is a
     * `service`, is `inSwitcher`, and serves no HTML at all. Neither does `markId`, `inSwitcher` or
     * `basePath`. The footer needs exactly this question answered for every row — a footer link to
     * an address that 404s is worse than no footer — and the only honest place for the answer is
     * beside the hostname it is a fact about.
     *
     * **Every value below was measured through the estate gateway rather than reasoned about**, on
     * 2026-08-04, with `curl --cacert deploy/gateway/certs/ca.crt https://<sub>.cloudsforge.localtest.me/`.
     * `true` means that request returned `200 text/html`. The three `basePath` rows were measured at
     * their full path (`hub./account`, `hub./wallet`, `network./faucet` — all 200 text/html), because
     * for them the host answering is not the question.
     *
     * TWO RESULTS ARE WORTH NAMING, because they are not what the registry reads like:
     *
     *   - **`lantern` and `beacon` were the two `inSwitcher: true` rows that served no page, AND
     *     THEY NOW SERVE ONE.** Both answered `404 application/json` on their own hostname when
     *     this field was introduced, because the gateway routed the whole host to the API and said
     *     so in its own words — "no bundle is served at `beacon.<apex>`". The switcher therefore
     *     offered every operator two entries that could not open. That was recorded here as a
     *     pre-existing defect in `inSwitcher` rather than fixed, because the fix was not a registry
     *     edit: it was two frontends that did not exist. `micro-lantern-web` and `micro-beacon-web`
     *     were built, deployed, and given routers beside their services, and both rows were flipped
     *     to `true` ON THE MEASUREMENT and not before — quoted in full beside each one below.
     *
     *     THE ORDER IS THE POINT AND IS WORTH KEEPING. An earlier attempt flipped these two while
     *     the routers were still absent, and the footer suite caught it: setting this field before
     *     the address answers is a claim about the future, and the footer reads it to decide what to
     *     link, so a premature `true` puts a dead link on every surface in the estate.
     *   - **`account` is false** for the reason its own row already explains at length: nothing in
     *     the estate serves it. Measured `404 text/plain`.
     *
     * A new surface must state this. It is not optional precisely because the failure mode is a row
     * added without thinking about it and then advertised estate-wide by a footer that assumed.
     */
    readonly servesUi: boolean;
    readonly inSwitcher: boolean;
    /** Hidden from the switcher unless the viewer holds the `admin` role. */
    readonly adminOnly?: boolean;
}
/**
 * The company colour. It is CHROME — the logo mark, the primary call to action, the bar seam and
 * Forge Hub — and it is never a product accent. It used to be both, which is how the switcher
 * ended up unable to tell Hearth (#ff5a1e) from the company (#e8622c) at dE 4.1.
 */
export declare const CLOUDSFORGE_EMBER = "#e8622c";
/**
 * The six validated product accents, in switcher order.
 *
 * Exported so the guard test can assert that no product in the registry wears anything else.
 * That test is the mechanism that stops a sixth orange being added by hand, which is exactly how
 * the previous palette reached five oranges out of six accents.
 *
 * ## The sixth accent, and how it was chosen
 *
 * `#1e89c7` — Forge Foresight. **Blue was the empty region of the palette**: the five before it
 * are red, teal, gold, purple and green. It was found by search, not taste — hue swept in 2°
 * steps across four saturations and four values, filtered to the existing set's lightness and
 * chroma band and to a safe distance from every RETIRED_ACCENT, then scored on the metric that
 * actually governs this palette.
 *
 * Measured with CIEDE2000 over a Viénot dichromat simulation, normal + deuteranopia + protanopia:
 *
 * | | before | after |
 * | --- | --- | --- |
 * | worst ADJACENT pair | dE 36.1 | **dE 36.1 — unchanged** |
 * | all-pairs floor | dE 5.6 | **dE 5.6 — unchanged** |
 *
 * It is first in the array because that is the insertion point the search chose: its only
 * neighbour is then `network`'s red, which it clears by dE 50 normal and dE 65 deuteranopic. Any
 * other position puts it beside `trade` or `market` and the adjacent guarantee collapses to dE 8.
 *
 * **The one thing to know before using it elsewhere:** blue sits dE 7.1 from `trade`'s teal and
 * dE 8.1 from `market`'s purple under deuteranopia, because deuteranopia collapses the whole
 * blue-teal-purple region. That is above the palette's existing dE 5.6 floor, so it worsens
 * nothing — but Foresight must never be rendered adjacent to Trade, and the accent must never be
 * the only cue distinguishing two things. The rule below already says product accents are not a
 * categorical palette; this is the sharpest instance of why.
 *
 * **A discrepancy left visible rather than reconciled.** The figures recorded in
 * docs/ecosystem/03 for the original five (worst adjacent dE 17.0 normal, 12.9 deuteranopic) do
 * not reproduce under the method above, which measures the same five at 36.1 and 37.6 — a
 * different formula or dichromat severity. The comparison here is internally consistent: both
 * columns of the table use one metric, so the *relative* guarantee is sound. But the two absolute
 * sets of numbers cannot both be right, and nobody has yet established which is.
 */
export declare const PRODUCT_ACCENTS: readonly ["#1e89c7", "#d6412f", "#2a9e93", "#b28e1e", "#9b7bf0", "#6d9a49"];
/**
 * Accents that were retired, and must never reappear anywhere in the registry.
 *
 * The first four are the oranges that could not be told apart from each other or from the
 * company ember. The last is the value baked into generated artwork by `asset-forge`'s
 * BRAND_STYLE, which is a sixth ember nobody ever chose — the art track now seeds from the
 * registry accent instead.
 */
export declare const RETIRED_ACCENTS: readonly ["#ff5a1e", "#ff8a1f", "#d9812f", "#ff7a2f", "#ff4d00"];
/**
 * Every surface, products first IN SWITCHER ORDER.
 *
 * THE ORDER OF THE FIRST FIVE ENTRIES IS LORE-BEARING. It is network, trade, create, market,
 * worlds — the order that maximises the separation of neighbouring accents, not the order the
 * product story is told in ("mine it, trade it, make it, sell it, play in it" happens to be
 * close, but that is a coincidence and must not be relied on).
 *
 * The switcher is a vertical list, so only NEIGHBOURS ever touch, which makes adjacent
 * separation the honest gate; requiring all-pairs separation across eight brand-faithful hues is
 * unachievable and was verified so exhaustively. In this order the worst adjacent pair measures
 * dE 12.9 under deuteranopia and dE 17.0 under normal vision. Reorder the array for narrative
 * reasons and that guarantee is gone — a switcher is a lookup list, not a story.
 *
 * The marketing site is deliberately absent from the switcher: the logo in the bar already links
 * there, and a second route to the same page costs a slot. Forge Hub is absent for a different
 * reason — it is the container the user is already inside, not a destination.
 */
export declare const SURFACES: readonly CloudsForgeSurface[];
/** Look a surface up, loudly. An unknown key is a typo, and a typo must not resolve to a URL. */
export declare function surface(key: SurfaceKey): CloudsForgeSurface;
/**
 * The five products, in switcher order. This is also what the marketing site counts and renders,
 * so a new product is a registry entry rather than a copy-editing pass across six repositories.
 */
export declare const PRODUCTS: readonly CloudsForgeSurface[];
/** Everything the switcher may show, in order: the six products, then the operator tools. */
export declare const SWITCHER_SURFACES: readonly CloudsForgeSurface[];
/**
 * Every surface a person can actually open. The footer's whole link list is a partition of this.
 *
 * `signin` is the ONE exclusion, and it is stated here rather than buried in the footer so the
 * rule stays readable: signing in is a state transition the account menu in the bar already owns,
 * and "Sign in to CloudsForge" sitting in the footer of a page a signed-in reader is looking at is
 * simply wrong. Nothing else is filtered — an entry is in this list because the registry says the
 * address answers, not because somebody chose it.
 */
export declare const FOOTER_SURFACES: readonly CloudsForgeSurface[];
/**
 * The footer's columns: a partition of {@link FOOTER_SURFACES} by `kind`, in registry order.
 *
 * Three groups because `kind` already has three values and they already mean the right thing —
 * "something you chose", "a way into the platform", "a tool or a title". No fourth heading, no
 * per-surface placement field, and therefore nothing to keep in step: a new registry row lands in
 * a column by virtue of what it IS.
 *
 * `adminOnly` is NOT filtered here — the renderer does that, because it is the only party that
 * knows who is looking. See `CloudsForgeFooter`.
 */
export declare const FOOTER_GROUPS: readonly {
    readonly kind: SurfaceKind;
    readonly title: string;
    readonly surfaces: readonly CloudsForgeSurface[];
}[];
/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export declare const KNOWN_SUBS: ReadonlySet<string>;
/**
 * The labels that name an ENVIRONMENT rather than a surface.
 *
 * ── THE ENVIRONMENT IS A SUFFIX ON THE SUBDOMAIN, NOT A PREFIX ON THE APEX ────────────────────
 *
 * Every environment shares one apex and distinguishes itself inside the FIRST LABEL:
 *
 *     mainnet   hub.cloudsforge.online              no label — the unadorned form
 *     testnet   hub-testnet.cloudsforge.online      label `testnet`, suffixed to `hub`
 *               testnet.cloudsforge.online          the apex surface, where there is no
 *                                                   subdomain to suffix, so the label stands alone
 *
 * It used to be the other way round — `hub.testnet.cloudsforge.online`, an apex of
 * `testnet.cloudsforge.online` — and that shape was CONFIGURED AND UNREACHABLE. Cloudflare's
 * Universal SSL certificate is `*.cloudsforge.online` plus the apex, a wildcard matches exactly
 * one label, and so every two-label testnet hostname failed the TLS handshake at Cloudflare's
 * edge before a request reached this estate at all. Covering it needs Advanced Certificate
 * Manager, which is paid and is not bought. One label is covered by the certificate that already
 * exists, which is the whole of the reason.
 *
 * ── WHY THE SET IS LARGER THAN THE ONE ENVIRONMENT THAT EXISTS ────────────────────────────────
 *
 * `testnet` is deployed. The other four are reserved, and reserving them costs nothing today
 * while each is a word somebody will eventually want for an environment. They are listed HERE,
 * once, rather than in the check that guards them: `deploy/scripts/check-apex-prefix.py` reads
 * this export by running this module, so the estate has one list instead of two that can drift —
 * which is the failure this whole file exists to end.
 *
 * ── WHAT A LABEL IN THIS SET FORBIDS ──────────────────────────────────────────────────────────
 *
 * Two things, and `check-apex-prefix.py` fails on either:
 *
 *   1. No surface may take one of these as its `subdomain`. A surface called `testnet` would make
 *      `testnet.cloudsforge.online` ambiguous — the mainnet surface, or the testnet apex page?
 *      `cloudsforgeHosts()` reads it as the second, so the first would silently resolve every
 *      link on that page to a testnet address.
 *   2. No surface's `subdomain` may END WITH `-<label>`. A surface called `hub-testnet` would
 *      make `hub-testnet.cloudsforge.online` ambiguous in the same way, and this one resolves the
 *      OTHER direction: a page on the mainnet surface `hub-testnet` would compose every sibling
 *      address on testnet.
 */
export declare const ENV_LABELS: ReadonlySet<string>;
/**
 * Split a browser hostname's first label into `{subdomain, env}`, or `null` when it names no
 * environment at all.
 *
 * ── THE SPLIT IS ON THE LAST HYPHEN, AND NOTHING CURRENTLY EXERCISES THAT ─────────────────────
 *
 * `worlds-api` was the one registry subdomain containing a hyphen, and it is the case this rule
 * was written for: `worlds-api-testnet` had to read as the surface `worlds-api` on `testnet` and
 * not as the surface `worlds` on an environment called `api-testnet`. That row was deleted when
 * the hostname was folded into `api.` — CHECKED, not assumed: no `subdomain` in this file now
 * contains a hyphen, so last-hyphen and first-hyphen splitting agree on every name the estate
 * serves and no test can tell them apart.
 *
 * IT STAYS `lastIndexOf`. The rule is still the correct one — the next hyphenated subdomain
 * anyone adds gets the right answer with no edit here — and changing it now would be a change
 * no test could catch, made for appearance, to a function that resolves every sibling link in
 * every bundle. If you add a hyphenated subdomain, add a case here alongside it.
 *
 * ── BOTH HALVES ARE CHECKED, AND NEITHER CHECK IS REDUNDANT ───────────────────────────────────
 *
 * The tail must be a known environment label and the head must be a known registry subdomain.
 * Requiring only the tail would read `marketing-testnet.cloudsforge.online` — a hostname this
 * estate does not own and might one day be handed — as testnet's `marketing` surface, and
 * resolve every sibling link on it into this estate. Requiring only the head would read
 * `hub-2024` as `hub` on an environment called `2024`. An unrecognised shape is left alone and
 * treated as its own apex, which is the same refusal-to-guess that keeps preview deployments
 * working (see `cloudsforgeHosts`).
 */
export declare function splitEnvLabel(label: string): {
    subdomain: string;
    env: string;
} | null;
/**
 * The first label a surface is served under in `env`. An empty `env` is the unadorned form.
 *
 * One function, so that "what is a surface called on an environment" has exactly one definition
 * and `splitEnvLabel` above is its inverse. The apex surface (`subdomain: ''`) collapses to the
 * bare label rather than producing `-testnet`, which is not a legal DNS label.
 */
export declare function envLabel(subdomain: string, env: string): string;
