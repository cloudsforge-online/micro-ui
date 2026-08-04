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
export type ProductKey = 'foresight' | 'network' | 'trade' | 'create' | 'market' | 'worlds'

/** Everything that may appear in the product switcher, products plus the operator tools. */
export type SwitcherKey = ProductKey | 'admin' | 'lantern' | 'beacon'

/** Every addressable CloudsForge surface, including the ones with no UI of their own. */
export type SurfaceKey =
  | SwitcherKey
  | 'foresight-admin'
  | 'hub'
  | 'signin'
  | 'site'
  | 'emberkin'
  | 'aetherholm'
  | 'tessera'
  | 'wallet'
  | 'faucet'
  | 'developers'
  | 'status'
  | 'explorer'
  | 'nimbus'
  | 'account'
  | 'api'
  | 'worlds-api'
  | 'pay'
  | 'keyvault'

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
export type SurfaceKind = 'product' | 'surface' | 'service'

export interface CloudsForgeSurface {
  readonly key: SurfaceKey
  /** The name a person reads. Always the surface's real name, never a category. */
  readonly name: string
  /** The verb this surface owns in "mine it, trade it, make it, sell it, play in it". */
  readonly verb: string | null
  readonly kind: SurfaceKind
  /** Subdomain under the apex. An empty string means the apex itself. */
  readonly subdomain: string
  /** Port on localhost, for `pnpm dev` and the local compose stack. */
  readonly devPort: number
  /**
   * Set when this surface is a ROUTE on another surface's host rather than a host of its own —
   * `subdomain` and `devPort` then name the host it lives on, and the URL is that origin plus
   * this path.
   */
  readonly basePath?: string
  /** The accent, from the validated set below. Never invented locally. */
  readonly accent: string
  /** Switcher glyph. Present on every switcher entry, because colour is never the only channel. */
  readonly glyph: string
  /** asset-forge id for this surface's brand mark, when it has one. */
  readonly markId: string | null
  /** One line, shown under the name in the switcher and on product cards. */
  readonly blurb: string
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
   *   - **`lantern` and `beacon` are `inSwitcher: true` and serve no page.** Both answered
   *     `404 application/json` on their own hostname. deploy/gateway/dynamic/estate-web.yml:432
   *     says so in its own words — "no bundle is served at `beacon.<apex>`" — and routes the whole
   *     host to the API. So the operator switcher offers two entries that cannot open. That is a
   *     pre-existing defect in `inSwitcher`, NOT something this field creates; it is left visible
   *     here rather than fixed, because the switcher is not this change's subject and silently
   *     flipping `inSwitcher` would remove two entries an operator may be relying on the presence
   *     of. The footer simply does not offer them.
   *   - **`account` is false** for the reason its own row already explains at length: nothing in
   *     the estate serves it. Measured `404 text/plain`.
   *
   * A new surface must state this. It is not optional precisely because the failure mode is a row
   * added without thinking about it and then advertised estate-wide by a footer that assumed.
   */
  readonly servesUi: boolean
  readonly inSwitcher: boolean
  /** Hidden from the switcher unless the viewer holds the `admin` role. */
  readonly adminOnly?: boolean
}

/**
 * The company colour. It is CHROME — the logo mark, the primary call to action, the bar seam and
 * Forge Hub — and it is never a product accent. It used to be both, which is how the switcher
 * ended up unable to tell Hearth (#ff5a1e) from the company (#e8622c) at dE 4.1.
 */
export const CLOUDSFORGE_EMBER = '#e8622c'

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
] as const

/**
 * Accents that were retired, and must never reappear anywhere in the registry.
 *
 * The first four are the oranges that could not be told apart from each other or from the
 * company ember. The last is the value baked into generated artwork by `asset-forge`'s
 * BRAND_STYLE, which is a sixth ember nobody ever chose — the art track now seeds from the
 * registry accent instead.
 */
export const RETIRED_ACCENTS = ['#ff5a1e', '#ff8a1f', '#d9812f', '#ff7a2f', '#ff4d00'] as const

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
export const SURFACES: readonly CloudsForgeSurface[] = [
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
    inSwitcher: true,
    adminOnly: true,
  },
  {
    // The Foresight operator panel. It is here for the same reason `emberkin` is, and it is the
    // last surface in the estate that was missing: **a hostname absent from this registry is
    // absent from `KNOWN_SUBS`, so `cloudsforgeHosts()` cannot strip it when deriving the apex,
    // and every address that bundle composes gains a level.** Served at `foresight-admin.<apex>`
    // it resolved sign-out to `https://hub.foresight-admin.<apex>/account/logout` — a 404 — and
    // identity, billing and telemetry the same way, so the console could not deliver a single
    // telemetry sample. `lantern.foresight-admin.<apex>` is served by nothing.
    //
    // Sign-out was only the loudest symptom, which is why the fix is this row and not a gateway
    // rewrite: rewriting the one URL would have hidden a 404 and left the other three composing
    // hostnames that do not exist. Recorded from both ends before it was fixed —
    // `deploy/compose/docker-compose.estate.yml` beside the container, and
    // `foresight-admin-web/src/lib/hosts.ts`, which carried the diagnosis in its header while
    // deliberately refusing to shim it locally.
    //
    // **`inSwitcher` is false and that is not an oversight.** 19-new-products.md §2.2 folds this
    // console into `admin-web` at P13 — "kept as its own small surface for now". The row exists so
    // the apex derives correctly today; it is not a claim that this deserves a permanent hostname.
    // When the fold happens this entry goes, and the gateway route with it.
    key: 'foresight-admin',
    name: 'Foresight Admin',
    verb: null,
    kind: 'service',
    subdomain: 'foresight-admin',
    // 5185, from `foresight-admin-web/vite.config.ts:44`. Unlike `admin`, `foresight`, `emberkin`
    // and the rest, this number is NOT the port of a service behind the hostname, because there is
    // no such service: the console calls Foresight's API (`API_SURFACE = 'foresight'`,
    // `foresight-admin-web/src/lib/hosts.ts:33`), which resolves through the `foresight` row and
    // its 4021. So nothing ever resolves this surface as an API target, and the honest value is
    // the address at which the surface itself answers under `pnpm dev`.
    //
    // That places it in the category `surfaces.test.ts` already names: entries whose registry port
    // "really is an allocation", which is why it is deliberately absent from that test's BOUND map
    // rather than pinned to a service file that does not exist.
    devPort: 5185,
    accent: '#4f7fc2',
    glyph: '◈',
    markId: null,
    blurb: 'Foresight operator panel, folding into Admin',
    servesUi: true,
    inSwitcher: false,
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
    servesUi: false,
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
    servesUi: false,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
    inSwitcher: false,
  },
  {
    // The FOURTH Forge Worlds title, beside Emberkin and Aetherholm: a persistent, user-made
    // isometric world in a browser tab. Present for the same reason those two are — a surface
    // absent from this registry is absent from KNOWN_SUBS, so `cloudsforgeHosts()` cannot strip
    // `tessera.` when deriving the apex and resolves identity, billing and telemetry to
    // `nimbus.tessera.<apex>` and friends: hostnames that do not exist.
    //
    // This one has a second consumer the other two do not. micro-tessera's own suite reads this
    // row back and asserts the service and the registry agree about the port — so a wrong number
    // here fails a build in another repository rather than being discovered in a browser.
    key: 'tessera',
    name: 'Tessera',
    verb: null,
    kind: 'service',
    subdomain: 'tessera',
    // ══════════════════════════════════════════════════════════════════════════════════════════
    // 4022, AND IT IS THE ONE NUMBER IN THIS ROW THAT WAS ARGUED RATHER THAN PICKED.
    //
    // It is the port the service binds — `tessera/src/env.ts:55`, `DEFAULT_PORT = 4022` — and a
    // devPort is a fact about a service, not an allocation. That much is the standing rule, and
    // it has been broken three times (foresight carried beacon's 4011; emberkin carried 3014
    // while binding 4100; admin carried 3002 while admin-api binds 4014).
    //
    // What is different here is WHY the service binds 4022 rather than something in the 4100s.
    // 23-tessera.md §10.1 separates three port spaces this estate keeps confusing: the port a
    // service binds, the HOST port in the estate compose file (derived — `4100 + index in
    // deployableRepos()`, org/tools/cfctl.ts:864-871), and this field. Spaces one and two already
    // collide three times: emberkin binds 4100, which is identity's compose host port; aetherholm
    // binds 4120, which is admin-api's; nda binds 4110, which is notify's. Each of those services
    // binds a number the estate hands to somebody else.
    //
    // 4022 sits BELOW the derived 4100+ block, so no number of repositories appended to
    // `deployableRepos()` can grow into it. The point is not that 4022 is free today — 4100 was
    // free the day emberkin took it — but that it is in a region the derivation cannot reach.
    // **Do not tidy this into the 4100 block.** Its distance from that block is the property.
    // ══════════════════════════════════════════════════════════════════════════════════════════
    devPort: 4022,
    // Worlds' accent: a title wears its product's colour rather than claiming one of its own,
    // exactly as Emberkin and Aetherholm do above.
    accent: '#6d9a49',
    glyph: '◆',
    markId: null,
    blurb: 'A world you build in a browser tab, played through Forge Worlds',
    servesUi: true,
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
    servesUi: true,
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
    servesUi: true,
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
    servesUi: false,
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
    servesUi: false,
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
    servesUi: false,
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
    servesUi: false,
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
    blurb: 'Payments, balances and settlement',
    servesUi: false,
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
    servesUi: false,
    inSwitcher: false,
  },
]

const BY_KEY = new Map(SURFACES.map((s) => [s.key, s]))

/** Look a surface up, loudly. An unknown key is a typo, and a typo must not resolve to a URL. */
export function surface(key: SurfaceKey): CloudsForgeSurface {
  const found = BY_KEY.get(key)
  if (!found) throw new Error(`Unknown CloudsForge surface: ${key}`)
  return found
}

/**
 * The five products, in switcher order. This is also what the marketing site counts and renders,
 * so a new product is a registry entry rather than a copy-editing pass across six repositories.
 */
export const PRODUCTS: readonly CloudsForgeSurface[] = SURFACES.filter((s) => s.kind === 'product')

/** Everything the switcher may show, in order: the six products, then the operator tools. */
export const SWITCHER_SURFACES: readonly CloudsForgeSurface[] = SURFACES.filter((s) => s.inSwitcher)

/**
 * Every surface a person can actually open. The footer's whole link list is a partition of this.
 *
 * `signin` is the ONE exclusion, and it is stated here rather than buried in the footer so the
 * rule stays readable: signing in is a state transition the account menu in the bar already owns,
 * and "Sign in to CloudsForge" sitting in the footer of a page a signed-in reader is looking at is
 * simply wrong. Nothing else is filtered — an entry is in this list because the registry says the
 * address answers, not because somebody chose it.
 */
export const FOOTER_SURFACES: readonly CloudsForgeSurface[] = SURFACES.filter(
  (s) => s.servesUi && s.key !== 'signin',
)

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
export const FOOTER_GROUPS: readonly {
  readonly kind: SurfaceKind
  readonly title: string
  readonly surfaces: readonly CloudsForgeSurface[]
}[] = [
  { kind: 'product', title: 'Products', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'product') },
  { kind: 'surface', title: 'Platform', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'surface') },
  { kind: 'service', title: 'More', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'service') },
]

/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export const KNOWN_SUBS: ReadonlySet<string> = new Set(
  SURFACES.map((s) => s.subdomain)
    .filter(Boolean)
    .concat('www'),
)
