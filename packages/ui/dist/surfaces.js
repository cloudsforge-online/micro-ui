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
/**
 * The company colour. It is CHROME — the logo mark, the primary call to action, the bar seam and
 * Forge Hub — and it is never a product accent. It used to be both, which is how the switcher
 * ended up unable to tell Hearth (#ff5a1e) from the company (#e8622c) at dE 4.1.
 */
export const CLOUDSFORGE_EMBER = '#e8622c';
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
export const PRODUCT_ACCENTS = [
    '#1e89c7',
    '#d6412f',
    '#2a9e93',
    '#b28e1e',
    '#9b7bf0',
    '#6d9a49',
];
/**
 * Accents that were retired, and must never reappear anywhere in the registry.
 *
 * The first four are the oranges that could not be told apart from each other or from the
 * company ember. The last is the value baked into generated artwork by `asset-forge`'s
 * BRAND_STYLE, which is a sixth ember nobody ever chose — the art track now seeds from the
 * registry accent instead.
 */
export const RETIRED_ACCENTS = ['#ff5a1e', '#ff8a1f', '#d9812f', '#ff7a2f', '#ff4d00'];
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
export const SURFACES = [
    /* --- the six products, in the validated separation order ----------- */
    {
        key: 'foresight',
        name: 'Forge Foresight',
        verb: 'Predict',
        kind: 'product',
        subdomain: 'foresight',
        // 4021, because that is the port the service actually binds
        // (`foresight/.env.example:13`). It was briefly 4011, which is beacon's — so
        // `cloudsforgeHosts().foresight` resolved a local stack to the monitoring service.
        devPort: 4021,
        // Blue was the empty region of the palette: the other five are red, teal, gold, purple and
        // green. Chosen by search rather than taste — see the note above PRODUCT_ACCENTS.
        accent: '#1e89c7',
        glyph: '◈',
        markId: 'mark-foresight',
        blurb: 'Stake on what happens next, settled on chain',
        inSwitcher: true,
    },
    {
        key: 'network',
        name: 'Forge Network',
        verb: 'Mine',
        kind: 'product',
        subdomain: 'network',
        devPort: 3003,
        accent: '#d6412f',
        glyph: '●',
        markId: 'mark-network',
        blurb: 'The chain, its explorer and the faucet',
        inSwitcher: true,
    },
    {
        key: 'trade',
        name: 'Forge Trade',
        verb: 'Trade',
        kind: 'product',
        subdomain: 'trade',
        devPort: 4006,
        accent: '#2a9e93',
        glyph: '◐',
        markId: 'mark-trade',
        blurb: 'Test the idea before you fund it',
        inSwitcher: true,
    },
    {
        key: 'create',
        name: 'Forge Create',
        verb: 'Make',
        kind: 'product',
        subdomain: 'create',
        devPort: 4004,
        accent: '#b28e1e',
        glyph: '✦',
        markId: 'mark-create',
        blurb: 'Launch a token, cross-chain',
        inSwitcher: true,
    },
    {
        key: 'market',
        name: 'Forge Market',
        verb: 'Sell',
        kind: 'product',
        subdomain: 'market',
        devPort: 4007,
        accent: '#9b7bf0',
        glyph: '◇',
        markId: 'mark-market',
        blurb: 'Discover, list, offer, settle',
        inSwitcher: true,
    },
    {
        key: 'worlds',
        name: 'Forge Worlds',
        verb: 'Play',
        kind: 'product',
        subdomain: 'worlds',
        devPort: 3001,
        accent: '#6d9a49',
        glyph: '▲',
        markId: 'mark-worlds',
        blurb: 'Ninety Days After, and what follows it',
        inSwitcher: true,
    },
    /* --- operator tools -------------------------------------------------
     * These render in the switcher below a separator, so they are never adjacent to a product
     * entry and their accents never have to separate from one. Hiding them from a player is not
     * the security boundary — each service verifies the `admin` role on the token itself — it
     * just keeps a menu entry nobody can open out of every player's face.
     * ------------------------------------------------------------------ */
    {
        key: 'admin',
        name: 'Admin',
        verb: null,
        kind: 'service',
        subdomain: 'admin',
        // 4014, because that is the port `admin-api` binds (`admin-api/src/env.ts:167`, and
        // `admin-api/.env.example:76`). It said 3002, which nothing anywhere listens on. Production
        // hid it — the console and its API share an origin behind `admin.<apex>`, so `apiBase()` is
        // '' and every request is relative — but `pnpm dev` resolved to a dead port. micro-admin-web
        // found it and deliberately did not paper over it with a literal, because a hard-coded host
        // is an unversioned second copy of this registry and the copy is the one that goes stale.
        //
        // A devPort is a FACT ABOUT A SERVICE, not an allocation. It is the third time this entry
        // class was wrong (foresight 4021 read as beacon's 4011; emberkin 4100 read as 3014), and the
        // collision guard could not catch any of them: a wrong port that collides with nothing looks
        // exactly like a right one. `surfaces.test.ts` now checks the value, not just its uniqueness.
        devPort: 4014,
        // Clay: an explicit block at last. The console has been setting data-cf-product="admin"
        // against a selector that did not exist, falling through to the ember default in silence.
        accent: '#c2704f',
        glyph: '▣',
        markId: null,
        blurb: 'Operator console, every action audited',
        inSwitcher: true,
        adminOnly: true,
    },
    {
        key: 'lantern',
        name: 'Lantern',
        verb: null,
        kind: 'service',
        subdomain: 'lantern',
        devPort: 4010,
        accent: '#f4a63c',
        glyph: '✷',
        markId: null,
        blurb: 'Logs & errors',
        inSwitcher: true,
        adminOnly: true,
    },
    {
        key: 'beacon',
        name: 'Beacon',
        verb: null,
        kind: 'service',
        subdomain: 'beacon',
        devPort: 4011,
        // Signal green, matching the chart `good` step. For a status tool the surface agreeing with
        // its healthiest verdict is correct; a second unrelated hue would be the one thing a status
        // page must not do. Beacon's own pages still reserve green/amber/red for probe verdicts.
        accent: '#7fae5c',
        glyph: '◉',
        markId: null,
        blurb: 'Status & uptime',
        inSwitcher: true,
        adminOnly: true,
    },
    /* --- containers and front doors: never switcher entries ------------ */
    {
        key: 'hub',
        name: 'Forge Hub',
        verb: null,
        kind: 'surface',
        subdomain: 'hub',
        devPort: 3010,
        accent: CLOUDSFORGE_EMBER,
        glyph: '◆',
        markId: 'mark-hub',
        blurb: 'Dashboard, portfolio, wallet, activity',
        inSwitcher: false,
    },
    {
        /**
         * THE SIGN-IN SURFACE — the page `signInRedirect()` sends every product to.
         *
         * ── Why this row exists, and why it rides on Hub ───────────────────────────────────────────
         *
         * `accountUrl()` used to resolve the `account` row below, which is `account.<apex>` in
         * production and `localhost:4001` under `pnpm dev`. **Nothing in the estate serves either
         * address.** `micro-identity` binds 4001 and renders no HTML at all — `identity/src/server.ts`
         * §3 forbids it ("NO PRODUCT FEATURE LIVES HERE… no portal") and
         * `identity/src/server.test.ts:890` asserts that `/`, `/portal` and friends 404. There is no
         * `account-web` among the 58 repositories. So every product in the estate sent every
         * signed-out visitor to a page that has never existed, and nobody could sign in from a
         * browser. Recorded as the largest blocker in docs/ecosystem/22 §8.1.
         *
         * A surface has to SERVE it. Forge Hub is the one that can, today, with no new hostname, no
         * new container and no DNS: it is already deployed, it already routes `/account/*` (hub-api's
         * next-action cards deep-link into it), and `hub.cloudsforge.online` is already on the
         * gateway's CORS allowlist (`deploy/gateway/dynamic/policy.yml`) — which the sign-in page
         * needs, because it POSTs credentials to `nimbus.<apex>` cross-origin. `account.<apex>` is
         * NOT on that allowlist, so a page served there could not have called identity even if
         * something had served it.
         *
         * This is a NEW row rather than an edit to `account` on purpose. `account` is asserted by name
         * in the host tests of six sibling frontends this change does not own — `site`, `web-template`,
         * `hub-web`, `foresight-web`, `admin-web`, `foresight-admin-web` — and repointing it would
         * turn one defect into six red suites. `account` keeps its meaning as the reserved hostname;
         * `signin` is the address a person is actually sent to. The day something is served at
         * `account.<apex>`, this row's `subdomain`/`devPort`/`basePath` change and nothing else does.
         */
        key: 'signin',
        name: 'Sign in to CloudsForge',
        verb: null,
        kind: 'surface',
        subdomain: 'hub',
        devPort: 3010,
        basePath: '/account',
        accent: CLOUDSFORGE_EMBER,
        glyph: '◇',
        markId: null,
        blurb: 'One account, every surface',
        inSwitcher: false,
    },
    {
        key: 'site',
        name: 'CloudsForge',
        verb: null,
        kind: 'surface',
        subdomain: '',
        devPort: 3000,
        accent: CLOUDSFORGE_EMBER,
        glyph: '◆',
        markId: 'mark-cloudsforge',
        blurb: 'One platform, five products',
        inSwitcher: false,
    },
    {
        // The wallet is a page inside Hub, not a host: Forge Pay stopped being a destination when
        // Hub absorbed the balance, receive and withdraw screens. It keeps a registry row because
        // things still deep-link to it, and `basePath` is what makes its subdomain and port true
        // rather than decorative — the previous registry gave the wallet the payments API's
        // hostname, an address with no wallet on it, and nothing broke only because every caller
        // special-cased it.
        key: 'wallet',
        name: 'Wallet',
        verb: 'Spend',
        kind: 'surface',
        subdomain: 'hub',
        devPort: 3010,
        basePath: '/wallet',
        accent: CLOUDSFORGE_EMBER,
        glyph: '◈',
        markId: null,
        blurb: 'Balances, deposits and withdrawals',
        inSwitcher: false,
    },
    {
        // A route on the Network site rather than a host of its own: a faucet is one form on one
        // page and does not warrant a certificate.
        key: 'faucet',
        name: 'Testnet faucet',
        verb: null,
        kind: 'surface',
        subdomain: 'network',
        devPort: 3003,
        basePath: '/faucet',
        accent: '#d6412f',
        glyph: '◍',
        markId: null,
        blurb: 'Test EMBER, rate limited',
        inSwitcher: false,
    },
    {
        // Reached from the footer, not the product switcher: a developer console is something a
        // person goes looking for, and it does not compete for a switcher slot with the products.
        key: 'developers',
        name: 'Developer Platform',
        verb: null,
        kind: 'surface',
        subdomain: 'developers',
        devPort: 3012,
        accent: '#4a86e0',
        glyph: '⌗',
        markId: null,
        blurb: 'Projects, keys, webhooks and docs',
        inSwitcher: false,
    },
    {
        // A Forge Worlds TITLE, not a sixth product: it is played through Worlds and appears in no
        // switcher. It is here because it is served from its own subdomain, and a surface absent from
        // this registry is absent from KNOWN_SUBS — so `cloudsforgeHosts()` could not strip
        // `emberkin.` when deriving the apex, and resolved identity, billing and telemetry to
        // `nimbus.emberkin.<apex>` and friends: three hostnames that do not exist. Found by
        // micro-emberkin-web, which carried a local correction until this entry existed.
        key: 'emberkin',
        name: 'Emberkin',
        verb: null,
        kind: 'service',
        subdomain: 'emberkin',
        // 4100, because that is the port the service binds (`emberkin/src/env.ts:121`,
        // `emberkin/.env.example:40`). It was briefly 3014 — a free-looking number chosen without
        // reading the service, which is precisely how foresight came to be given beacon's 4011. A
        // devPort is not an allocation; it is a fact about a service, and the test below reads it.
        devPort: 4100,
        // Worlds' accent: a title wears its product's colour rather than claiming one of its own.
        accent: '#6d9a49',
        glyph: '◆',
        markId: null,
        blurb: 'A monster-collecting RPG, played through Forge Worlds',
        inSwitcher: false,
    },
    {
        // The THIRD Forge Worlds title, beside Emberkin: a sky-island strategy MMO, played through
        // Worlds and in no switcher. Present for the same reason Emberkin is — a surface absent from
        // this registry is absent from KNOWN_SUBS, and `cloudsforgeHosts()` then cannot strip its
        // subdomain when deriving the apex.
        key: 'aetherholm',
        name: 'Aetherholm',
        verb: null,
        kind: 'service',
        subdomain: 'aetherholm',
        // 4120, because that is the port the service binds (`aetherholm/src/env.ts:105`,
        // `aetherholm/.env.example:31`). A devPort is a fact about a service, not an allocation —
        // this entry class has been wrong three times, so the test below reads the value.
        devPort: 4120,
        // Worlds' accent: a title wears its product's colour rather than claiming one of its own,
        // exactly as Emberkin does above.
        accent: '#6d9a49',
        glyph: '◆',
        markId: null,
        blurb: 'A sky-island strategy MMO, played through Forge Worlds',
        inSwitcher: false,
    },
    {
        // Beacon's public face, pre-auth and redacted. It shares Beacon's accent block because it is
        // the same tool with its internals removed.
        key: 'status',
        name: 'Status',
        verb: null,
        kind: 'service',
        subdomain: 'status',
        devPort: 3013,
        accent: '#7fae5c',
        glyph: '◎',
        markId: null,
        blurb: 'Public status, no account needed',
        inSwitcher: false,
    },
    /* --- hostnames with no UI of their own ------------------------------ */
    {
        key: 'explorer',
        name: 'Network Explorer',
        verb: null,
        kind: 'service',
        subdomain: 'explorer',
        // 4008, the port `micro-indexer` binds (`indexer/src/env.ts:295`), NOT 8080.
        //
        // 8080 was this bundle's own nginx container port, which is the one number that is certainly
        // wrong here: `hosts.ts` uses devPort to resolve the host a frontend CALLS, so `explorer`
        // resolved to the app itself. Under `pnpm dev`, micro-explorer-web asked localhost:8080 —
        // where its own static server sits, if anything — for chain data, and an indexer started from
        // its own .env.example was never consulted.
        //
        // There is no separate `indexer` key to point at instead: `CloudsForgeHosts` is
        // `Record<SurfaceKey, string>`, so a frontend can only name a surface, and `explorer` is the
        // only one that means "the chain index". The registry entry therefore has to carry the
        // service's port, which is the same rule as everywhere else — a devPort is a fact about the
        // thing you call, not an allocation.
        devPort: 4008,
        accent: '#d6412f',
        glyph: '▦',
        markId: null,
        blurb: 'Blocks, transactions and addresses',
        inSwitcher: false,
    },
    {
        key: 'nimbus',
        name: 'Nimbus',
        verb: null,
        kind: 'service',
        subdomain: 'nimbus',
        devPort: 4001,
        accent: CLOUDSFORGE_EMBER,
        glyph: '◇',
        markId: null,
        blurb: 'Accounts & SSO',
        inSwitcher: false,
    },
    {
        // The same service as Nimbus on a second hostname: `nimbus.` is what issues tokens, `account.`
        // is the hostname RESERVED for the account portal. Both rows exist so neither meaning has to
        // be inferred from a string at a call site.
        //
        // NOTHING IS SERVED HERE TODAY. identity binds 4001 and renders no HTML (its own server.ts §3
        // forbids it; server.test.ts:890 asserts the 404s), and no repository in the estate serves
        // `account.<apex>`. The address a person is actually sent to sign in is the `signin` row
        // above — do not resolve this one for a redirect until something answers it.
        key: 'account',
        name: 'CloudsForge Account',
        verb: null,
        kind: 'service',
        subdomain: 'account',
        devPort: 4001,
        accent: CLOUDSFORGE_EMBER,
        glyph: '◇',
        markId: null,
        blurb: 'One account, everything',
        inSwitcher: false,
    },
    {
        // The public, versioned surface. It is empty until the developer platform claims it: today
        // `api.` still points at the game API, which is renamed to `worlds-api.` first. Renaming a
        // public hostname after third parties are on it costs a deprecation cycle.
        key: 'api',
        name: 'CloudsForge API',
        verb: null,
        kind: 'service',
        subdomain: 'api',
        devPort: 4020,
        accent: '#4a86e0',
        glyph: '▤',
        markId: null,
        blurb: 'The public v1 surface',
        inSwitcher: false,
    },
    {
        key: 'worlds-api',
        name: 'Worlds API',
        verb: null,
        kind: 'service',
        subdomain: 'worlds-api',
        devPort: 4002,
        accent: '#6d9a49',
        glyph: '▤',
        markId: null,
        blurb: 'The game platform API',
        inSwitcher: false,
    },
    {
        // Sage was retired as an ACCENT when Forge Pay stopped being a destination. It survives as
        // --cf-success, where it is doing brand work and never sits beside amber.
        key: 'pay',
        name: 'Forge Pay API',
        verb: null,
        kind: 'service',
        subdomain: 'pay',
        devPort: 4003,
        accent: CLOUDSFORGE_EMBER,
        glyph: '▤',
        markId: null,
        blurb: 'Payments & the Shard economy',
        inSwitcher: false,
    },
    {
        key: 'keyvault',
        name: 'ForgeKeyvault',
        verb: null,
        kind: 'service',
        subdomain: 'vault',
        devPort: 4005,
        accent: CLOUDSFORGE_EMBER,
        glyph: '▩',
        markId: null,
        blurb: 'Custodial key service',
        inSwitcher: false,
    },
];
const BY_KEY = new Map(SURFACES.map((s) => [s.key, s]));
/** Look a surface up, loudly. An unknown key is a typo, and a typo must not resolve to a URL. */
export function surface(key) {
    const found = BY_KEY.get(key);
    if (!found)
        throw new Error(`Unknown CloudsForge surface: ${key}`);
    return found;
}
/**
 * The five products, in switcher order. This is also what the marketing site counts and renders,
 * so a new product is a registry entry rather than a copy-editing pass across six repositories.
 */
export const PRODUCTS = SURFACES.filter((s) => s.kind === 'product');
/** Everything the switcher may show, in order: the six products, then the operator tools. */
export const SWITCHER_SURFACES = SURFACES.filter((s) => s.inSwitcher);
/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export const KNOWN_SUBS = new Set(SURFACES.map((s) => s.subdomain)
    .filter(Boolean)
    .concat('www'));
//# sourceMappingURL=surfaces.js.map