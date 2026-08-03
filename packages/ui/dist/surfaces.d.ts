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
export type SurfaceKey = SwitcherKey | 'foresight-admin' | 'hub' | 'signin' | 'site' | 'emberkin' | 'aetherholm' | 'tessera' | 'wallet' | 'faucet' | 'developers' | 'status' | 'explorer' | 'nimbus' | 'account' | 'api' | 'worlds-api' | 'pay' | 'keyvault';
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
/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export declare const KNOWN_SUBS: ReadonlySet<string>;
