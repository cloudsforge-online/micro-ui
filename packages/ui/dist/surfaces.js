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
        verb: 'Bet',
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
        blurb: 'Bet on what you think will happen, with the crypto you already hold',
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
        blurb: 'Mine EMBER in a browser tab, and explore the chain it lands on',
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
        blurb: 'Trade crypto natively, on chain, with no exchange in the middle',
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
        blurb: 'Launch your own token, on our chain or on Ethereum or Solana',
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
        blurb: 'Buy and sell anything on chain, with the money held until it arrives',
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
        blurb: 'Play games in your browser, and really own what you win in them',
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
        // 4014, because that is the port `admin-api` binds (`admin-api/src/env.ts`, and
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
        blurb: 'Operator console; every action is written to an audit log',
        servesUi: true,
        inSwitcher: true,
        adminOnly: true,
    },
    /* ── `foresight-admin` was a row here, and the P13 fold removed it ──────────────────────────
     *
     * The Foresight operator panel is now a SECTION inside the operator console — `admin-web`'s
     * `/foresight`, declared in that repository's `src/lib/routes.ts` — rather than a bundle on a
     * hostname of its own. `foresight-admin.<apex>` is served by nothing and resolves to nothing.
     *
     * ── Why this row existed at all, since deleting it undoes a real fix ────────────────────────
     *
     * It was added because a hostname ABSENT from this registry is absent from `KNOWN_SUBS`, so
     * `cloudsforgeHosts()` could not strip it when deriving the apex, and every address that bundle
     * composed gained a level: sign-out resolved to `https://hub.foresight-admin.<apex>/account/
     * logout`, a 404, and identity, billing and telemetry went the same way. The row fixed that by
     * making the subdomain known.
     *
     * Deleting it is safe for exactly one reason, and it is worth stating so that nobody restores
     * the row to be careful: **there is no longer a bundle served at that name.** The fix was needed
     * because something ANSWERED there; nothing does now. `admin.<apex>` is a known subdomain, so
     * the folded screens derive the apex correctly through the `admin` row.
     *
     * Its own comment predicted this: "`inSwitcher` is false and that is not an oversight …
     * 19-new-products.md §2.2 folds this console into `admin-web` at P13 … When the fold happens
     * this entry goes, and the gateway route with it." Both went, in the same change:
     * `deploy/gateway/dynamic/estate-web.yml` lost its bundle router, `policy.yml` lost the
     * CORS origin, `docker-compose.estate.yml` lost the container and `cloudflared/gen.py` lost two
     * tunnel hostnames. `deploy/scripts/surface-routes.py` is what makes that simultaneity
     * mandatory: check 2 fails on a router for a host no row declares, and check 5 fails on a CORS
     * origin no surface serves — so this deletion could not have landed alone.
     * ─────────────────────────────────────────────────────────────────────────────────────────── */
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
        blurb: 'Logs, errors and browser samples, for operators',
        // ── FLIPPED, AFTER THE PAGE ANSWERED AND NOT BEFORE ──────────────────────────────────────
        //
        // `micro-lantern-web` now serves this hostname, sharing it with `micro-lantern` — the gateway
        // splits them by path (deploy/gateway/dynamic/estate-web.yml, `cf-web-lantern` at priority
        // 500 and `cf-api-lantern` at 600). Measured through the estate gateway on 2026-08-04, by the
        // rule this field's own documentation states, with `--cacert` and no `-k`:
        //
        //   $ curl -o /dev/null -w '%{http_code} %{content_type}' --cacert deploy/gateway/certs/ca.crt \
        //       https://lantern.cloudsforge.localtest.me/
        //   200 text/html
        //
        // AND THE OTHER DIRECTION, WHICH IS WHY A 200 ALONE WOULD NOT HAVE JUSTIFIED THIS. A bundle
        // router matching the whole host would answer `/v1` with index.html — a 200 carrying HTML,
        // the failure this estate has been bitten by repeatedly — so both halves were driven:
        //
        //   /v1/issues     401 application/json    (the service, refusing an anonymous read)
        //   /otlp/v1/logs  404 application/json    ("no route for GET /otlp/v1/logs" — lantern's words)
        //   /ingest/client 404 application/json    (same; POST to it answers 202)
        //   /no-such-page  404 text/html           (the bundle's honest 404, not a 200 shell)
        //
        // Then signed in as an operator through the real hand-off in headless Chromium, because
        // signed-out is a sign-in panel BY DESIGN here (`adminOnly`) and a 200 for that panel would
        // not have been evidence: the console rendered the account chip and "Open issues … Lantern
        // answered with an empty list", read live from `GET /v1/issues` on this same origin.
        servesUi: true,
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
        blurb: 'Uptime, release gates and the checks behind them',
        // ── FLIPPED, ON THE SAME EVIDENCE AND BY THE SAME RULE ───────────────────────────────────
        //
        // `micro-beacon-web` shares `beacon.<apex>` with `micro-beacon`, and here that is not a
        // preference: Beacon sends no `access-control-*` header anywhere in its source and 404s a
        // preflight, so a console on any other hostname could not read it at all. The gateway splits
        // the host — `cf-web-beacon` at 500, `cf-api-beacon` at 600 over `/v1`, `/api`, `/metrics`,
        // `/livez` and `/readyz`. Measured on 2026-08-04:
        //
        //   $ curl -o /dev/null -w '%{http_code} %{content_type}' --cacert deploy/gateway/certs/ca.crt \
        //       https://beacon.cloudsforge.localtest.me/
        //   200 text/html
        //
        //   /v1/gate            401 application/json   (the service, refusing an anonymous read)
        //   /api/status/public  200 application/json   (still the public projection, unchanged)
        //   /no-such-page       404 text/html          (the bundle's honest 404)
        //
        // Then signed in as an operator: the console rendered the release gate and, on `/journeys`,
        // Beacon's own live journey list from `GET /v1/journeys` — same origin, no failed request.
        //
        // NOTE FOR THE READER OF `status`: this changes nothing there. `status.<apex>` still serves
        // `micro-status-web` and still reads `/api/status/public` on its own hostname through
        // `cf-api-status-public`. Two different surfaces read the same service; only this one is
        // `adminOnly`.
        servesUi: true,
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
        blurb: 'Your account: balances, wallet, activity and settings',
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
         * `identity/src/server.test.ts` asserts that `/`, `/portal` and friends 404. There is no
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
        blurb: 'One account for every part of CloudsForge',
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
        blurb: 'Mine, hold, bet, trade, launch, sell and play — on one account',
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
        blurb: 'Free test EMBER, for the test network only',
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
        blurb: 'API keys, projects, usage limits and documentation',
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
        // 4100, because that is the port the service binds (`emberkin/src/env.ts`,
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
        // 4120, because that is the port the service binds (`aetherholm/src/env.ts`,
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
        // It is the port the service binds — `tessera/src/env.ts`, `DEFAULT_PORT = 4022` — and a
        // devPort is a fact about a service, not an allocation. That much is the standing rule, and
        // it has been broken three times (foresight carried beacon's 4011; emberkin carried 3014
        // while binding 4100; admin carried 3002 while admin-api binds 4014).
        //
        // What is different here is WHY the service binds 4022 rather than something in the 4100s.
        // 23-tessera.md §10.1 separates three port spaces this estate keeps confusing: the port a
        // service binds, the HOST port in the estate compose file (derived — `4100 + index in
        // deployableRepos()`, org/tools/cfctl.ts), and this field. Spaces one and two already
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
        blurb: 'Is CloudsForge working right now? No account needed',
        servesUi: true,
        inSwitcher: false,
    },
    {
        /* ── THE MINING POOL, AND THE THREE FIELDS THAT ARE ARGUMENTS RATHER THAN CHOICES ────────
         *
         * `micro-pool` is a Stratum v1 server (docs/ecosystem/36-multi-chain-and-mining-pool.md §5)
         * and `micro-pool-web` is the console in front of it, sharing `pool.<apex>` the way lantern
         * and beacon share theirs — the bundle resolves its API base to the EMPTY STRING and issues
         * relative `/v1/...`, and the gateway splits the host by path (`cf-web-pool` at 500,
         * `cf-api-pool` at 600). Without this row `cloudsforgeHosts()` cannot strip the label and
         * every derived estate URL the bundle composes lands one level too deep, so the row is not
         * bookkeeping: it is what makes the console's own addresses resolve.
         *
         * `kind: 'service'` and NOT `'product'`. `ProductKey` is the six the design system validated
         * and the marketing site renders cards for; widening it here would put a sixth card on a page
         * whose copy, art and accent search were all done for five. A pool is a hostname with a UI,
         * which is what `service` + `servesUi` already means — the same shape `explorer` has.
         *
         * `inSwitcher: false` and NOT `adminOnly`. Every other `service` in the switcher is an
         * operator tool; this one is the opposite of one. `pool/src/env.ts` declares no
         * `IDENTITY_JWKS_URL` and no auth ON PURPOSE, because the only identity a miner has here is
         * the stratum username they chose, and 36 §6 makes "a miner can check their own share
         * history" a product requirement. Gating it behind an estate login would exclude every miner
         * without an account, which today is all of them. A surface anybody may open has no business
         * in an operator switcher either.
         *
         * `devPort: 4146` — the port micro-pool BINDS (`pool/src/env.ts`), not the 8080 the bundle's
         * own nginx serves. That is explorer's correction restated: devPort is a fact about the thing
         * you call, and writing the bundle's own port here is how explorer spent months asking itself
         * for chain data. 4146 is also what micro-org's registry derives for `pool`, which is
         * agreement rather than coincidence — both are "the service's port" read from the same file.
         *
         * `markId: null` — `micro-brand` has no `assets/pool/` set. Null is the honest answer; naming
         * a mark that does not exist renders nothing and reports nothing.
         *
         * ── 2026-08-10: THE SWITCHER QUESTION WAS RE-OPENED, AND `inSwitcher` STAYS FALSE ────────
         *
         * The ask was to make the pool a first-class product surface, and the switcher was the
         * obvious lever. It is the wrong one, and a guard in `surfaces.test.ts` says so before any
         * taste argument has to be settled: **"gives every entry a distinct accent"** asserts that
         * `SWITCHER_SURFACES` holds no two entries of the same hue. This row's accent is #b28e1e,
         * which is `create`'s — deliberately, per the note below it. Setting `inSwitcher: true`
         * therefore fails that test outright, and the only ways to pass it are to invent a seventh
         * validated accent (the note below records why that search is not worth making, and the
         * all-pairs separation work above records why it is close to unachievable across eight
         * brand-faithful hues) or to weaken a colour-accessibility guard for a marketing goal.
         *
         * Neither is a trade this registry should make, so discoverability was solved where it was
         * actually broken instead. The pool was not undiscoverable because it was missing from the
         * switcher; it was undiscoverable because the company site advertised it in prose on the
         * home page and every route to it was a dead end:
         *
         *   * `site/src/content/pages.ts` carries a home-page capability with `linkTo: 'pool'`, and
         *     `site/src/pages/home.tsx` renders `linkTo` as `/products/<slug>` — so the visible call
         *     to action "See the pool" resolved to `/products/pool`, which `site/nginx.conf`
         *     enumerates no location for and which answered a hard 404. Measured 2026-08-10.
         *   * `site` and `network-site` are the only two bundles in the estate that do NOT mount
         *     `CloudsForgeFooter`, and that footer is the one place `pool` was linked from at all
         *     (structurally, via `FOOTER_SURFACES`). The two public marketing surfaces — the ones a
         *     stranger meets first — were exactly the two with no link.
         *
         * So `micro-site` now serves `/products/pool` and links it from its own footer, and this row
         * is unchanged. A surface earns a switcher slot by being something a person chooses BETWEEN;
         * the pool is somewhere they are sent, and being sent there is what was missing. */
        key: 'pool',
        name: 'Mining Pool',
        verb: null,
        kind: 'service',
        subdomain: 'pool',
        devPort: 4146,
        // Gold, shared with `create` rather than newly invented. The accent guard forbids a sixth
        // orange and a resurrected retired hue; it does not forbid a service wearing a validated
        // product colour, and `explorer` and `nimbus` already do. A search for a seventh distinct
        // accent would be taste spent where the guard asks for none.
        accent: '#b28e1e',
        glyph: '▨',
        markId: null,
        blurb: 'Point real mining hardware at CloudsForge and be credited for the work',
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
        // 4008, the port `micro-indexer` binds (`indexer/src/env.ts`), NOT 8080.
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
        blurb: 'Look up any block, transaction or address on the chain',
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
        // forbids it; server.test.ts asserts the 404s), and no repository in the estate serves
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
        blurb: 'One account for everything on CloudsForge',
        servesUi: false,
        inSwitcher: false,
    },
    {
        // The public, versioned surface.
        //
        // ── THE FOLD WENT `worlds-api` -> `api`, AND EVERY EARLIER NOTE SAID THE REVERSE ───────────
        //
        // A `worlds-api` row sat below this one until 2026-08-05, and this comment used to plan the
        // split that would have justified it: "today `api.` still points at the game API, which is
        // renamed to `worlds-api.` first. Renaming a public hostname after third parties are on it
        // costs a deprecation cycle." THAT PLAN WAS NEVER CARRIED OUT AND THE OPPOSITE WAS. The game
        // API was consolidated INTO `api.`; `worlds-api.` was retired without ever getting a DNS
        // record on either network. The deprecation-cycle argument is why the direction flipped —
        // `api.` is the name a third party is given, so `api.` is the one that had to survive.
        //
        // The wrong direction was written down in at least four places (this row, the `worlds-api`
        // row, `deploy/gateway/dynamic/estate-web.yml` and `worlds-web/src/lib/hosts.ts`) and each
        // one made the next reader more confident. It is recorded here once, deliberately, because
        // deleting the claim without replacing it is how it came back the first time.
        //
        // Measured 2026-08-05: `worlds-api.cloudsforge.online` does not resolve, while
        // `api.cloudsforge.online` resolves and serves — `/v1/titles` answers 200, and an unmatched
        // path answers `404 text/plain`.
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
    {
        // ── THE ONE HOST IN THIS FILE A BROWSER RENDERS BUT NEVER NAVIGATES TO ─────────────────────
        //
        // micro-studio stores creator assets and serves them back as image bytes. Market and Foresight
        // put those bytes in `<img src>`, cross-origin, so this is a browser-facing origin for
        // UNTRUSTED USER UPLOADS — the one category of surface where the response headers are the last
        // line of defence rather than a formality. Uploads are validated by magic bytes, SVG is
        // rejected outright and EXIF is stripped, and the gateway adds `X-Content-Type-Options:
        // nosniff` on both entrypoint chains (`cf-security-headers`, attached in
        // docker-compose.gateway.yml and :266) so a stored file cannot be sniffed into script.
        //
        // `servesUi: false` because nothing here is a PAGE. It is not in the switcher and no footer
        // links it; a person never opens `studio.<apex>` and there is nothing to see if they do.
        //
        // devPort is 4015 because that is what the service itself defaults `PORT` to
        // (`studio/src/env.ts`), read rather than allocated. Six rows in this file are numbers
        // that were picked and then contradicted by the service that binds them — see the note in
        // `micro-devportal-web`'s hosts.ts, which counts them — and the cheapest way not to be the
        // seventh is to copy the service's own default. In the compose estate the port is 4000 for
        // every service, which is what the gateway routes to; this number is for `pnpm dev`.
        key: 'studio',
        name: 'CloudsForge Studio',
        verb: null,
        kind: 'service',
        subdomain: 'studio',
        devPort: 4015,
        accent: CLOUDSFORGE_EMBER,
        glyph: '▤',
        markId: null,
        blurb: 'Creator asset store — the image bytes Market and Foresight render',
        servesUi: false,
        inSwitcher: false,
    },
    /* --- the chain's own two ports -------------------------------------
     *
     * THE FIRST TWO ROWS WHOSE SERVICE IS NOT A CLOUDSFORGE SERVICE. Both are Hearth — the frozen
     * upstream node this estate follows rather than owns — and neither serves a page, an API in the
     * `/v1` house style, or anything a person opens. So the question of whether they belong in a
     * registry of SURFACES was a real one, and it is answered by what this file already is rather
     * than by taste.
     *
     * ── WHY THEY ARE HERE ──────────────────────────────────────────────────────────────────────
     *
     * The declaration above these rows says it: "Every addressable CloudsForge surface, INCLUDING
     * THE ONES WITH NO UI OF THEIR OWN." Five such rows already exist — nimbus, account, api, pay,
     * keyvault — and every one of them is a hostname the estate publishes and no person browses. `servesUi: false` is the field that carries exactly this distinction, and it
     * was introduced (see its own documentation above) so that a footer never links an address that
     * answers no HTML. These two set it false and are correctly invisible everywhere it matters:
     * FOOTER_SURFACES filters on it, SWITCHER_SURFACES filters on `inSwitcher`, and
     * `scripts/surface-routes.py`'s CORS check requires an allowlist entry only for a surface a
     * BROWSER loads a page from.
     *
     * The mechanical consequence is the one that decided it. `deploy/scripts/surface-routes.py`
     * check 2 fails on a gateway router matching a host no registry row declares — "dead
     * configuration (or the registry is missing a row, which is how foresight-admin was fixed)" —
     * and `rpc.<apex>` now has a router, because the owner's instruction was that RPC go behind
     * Traefik like everything else. The two honest ways to satisfy that check are a registry row or
     * an exemption list; an exemption would be the fifth hand-maintained copy of a hostname list in
     * an estate that has paid for four already. So: a row.
     *
     * The second consequence is a deletion. `deploy/cloudflared/gen.py` used to carry `RPC_PORT` and
     * an `rpc=True` flag that appended one hand-written ingress rule after the derived ones — the
     * single hostname in the whole tunnel that was not read from this file. With these rows it is
     * derived like every other, and that special case is gone.
     *
     * ── KNOWN_SUBS GAINS `rpc` AND `p2p`, AND THAT IS SAFE ─────────────────────────────────────
     *
     * Nothing is served at either address, so no bundle ever calls `cloudsforgeHosts()` with
     * `window.location.hostname` beginning `rpc.` or `p2p.` and no apex is ever derived from one.
     * `deploy/scripts/check-apex-prefix.py` guards the case that would matter — a subdomain
     * colliding with the way an environment names itself — and neither of these collides.
     *
     * THE SHAPE OF THAT COLLISION CHANGED ON 2026-08-05 and the sentence above is narrower than it
     * reads, so it is spelled out. The environment used to be an APEX PREFIX
     * (`hub.testnet.cloudsforge.online`), and the only hazard was a surface whose subdomain WAS an
     * environment name. It is now a SUBDOMAIN SUFFIX (`hub-testnet.cloudsforge.online`), so there
     * are two hazards: a subdomain equal to an environment label, and a subdomain ENDING IN
     * `-<label>`. `rpc` and `p2p` are neither. See {@link ENV_LABELS} at the foot of this file,
     * which is the list both this note and that check now read.
     * ------------------------------------------------------------------ */
    {
        // The Ethereum JSON-RPC endpoint of the EMBER chain: what MetaMask, Hardhat, Foundry and an
        // exchange point at. Port 8545 and path `/`, settled in `hearth/node/src/params.js`
        // (`DEFAULT_JSONRPC_PORT`), which also records why it cannot move: the number is published in
        // `ethereum-lists/chains` and cached in every user's saved networks.
        //
        // NOT 8645, and this is the one confusion worth spelling out beside the number. Hearth serves
        // TWO protocols on TWO ports — 8645 is the REST API plus the legacy `{method:'getinfo'}`
        // JSON-RPC and SSE (`hearth/node/src/rpc.js`), 8545 is Ethereum JSON-RPC 2.0
        // (`hearth/node/src/jsonrpc/server.js`). Only the second is the one a wallet speaks, so
        // only the second is published. 8546 is deliberately unpublished and unused: `params.js`
        // reserves it for the paired WebSocket `eth_subscribe` convention, which Hearth does not
        // implement.
        //
        // `servesUi: false` is measured rather than reasoned: the endpoint answers `405` with
        // `allow: POST,OPTIONS` to a GET (`jsonrpc/server.js`), so a browser opening this
        // address is told, correctly, that there is no page here.
        key: 'rpc',
        name: 'EMBER JSON-RPC',
        verb: null,
        kind: 'service',
        subdomain: 'rpc',
        devPort: 8545,
        // Forge Network's red. The chain is that product's subject, and a title wears its product's
        // colour rather than claiming one — the rule the three Worlds titles above follow. It is not a
        // switcher entry, so it never has to separate from a neighbour.
        accent: '#d6412f',
        glyph: '▤',
        markId: null,
        blurb: 'The EMBER chain, Ethereum JSON-RPC',
        servesUi: false,
        inSwitcher: false,
    },
    {
        // EMBER peer gossip, over WebSocket, so that P2P can cross a Cloudflare Tunnel at all.
        //
        // THE HOSTNAME EXISTS BECAUSE THE TRANSPORT DOES NOT WORK OTHERWISE. Hearth's peer transport
        // is raw TCP on 8646 (`hearth/node/src/params.js`, `DEFAULT_P2P_PORT`), and a tunnel
        // carries HTTP: there is no ingress rule that can publish a TCP socket to the internet through
        // it. A WebSocket is HTTP until the 101, which is why it is the transport that fits.
        //
        // 8648 AND `/p2p` ARE A CONTRACT, NOT A CHOICE. Hearth serves the WebSocket transport on
        // container port 8648 under `HEARTH_P2P_WS` at path `/p2p`; this row and
        // `deploy/gateway/dynamic/estate-web.yml`'s `cf-api-p2p` are the estate's half of that
        // agreement. 8647 and 8649 are already taken on the host by miner1's and miner2's REST ports
        // (`hearth/docker-compose.testnet.yml`), and 8646 is the TCP transport this one parallels
        // rather than replaces.
        //
        // `servesUi: false`: a WebSocket endpoint answers a plain GET with a 400 or a 426, never a
        // page. Nothing in the estate resolves this key from a browser at all — it is here so the
        // hostname is DECLARED, which is what makes its gateway router legitimate and its tunnel
        // ingress rule derived rather than hand-written.
        key: 'p2p',
        name: 'EMBER P2P',
        verb: null,
        kind: 'service',
        subdomain: 'p2p',
        devPort: 8648,
        accent: '#d6412f',
        glyph: '▤',
        markId: null,
        blurb: 'EMBER peer gossip, over WebSocket',
        servesUi: false,
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
/**
 * Every surface a person can actually open. The footer's whole link list is a partition of this.
 *
 * `signin` is the ONE exclusion, and it is stated here rather than buried in the footer so the
 * rule stays readable: signing in is a state transition the account menu in the bar already owns,
 * and "Sign in to CloudsForge" sitting in the footer of a page a signed-in reader is looking at is
 * simply wrong. Nothing else is filtered — an entry is in this list because the registry says the
 * address answers, not because somebody chose it.
 */
export const FOOTER_SURFACES = SURFACES.filter((s) => s.servesUi && s.key !== 'signin');
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
export const FOOTER_GROUPS = [
    { kind: 'product', title: 'Products', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'product') },
    { kind: 'surface', title: 'Platform', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'surface') },
    { kind: 'service', title: 'More', surfaces: FOOTER_SURFACES.filter((s) => s.kind === 'service') },
];
/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export const KNOWN_SUBS = new Set(SURFACES.map((s) => s.subdomain)
    .filter(Boolean)
    .concat('www'));
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
export const ENV_LABELS = new Set([
    'testnet',
    'staging',
    'preview',
    'dev',
    'mainnet',
]);
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
export function splitEnvLabel(label) {
    if (ENV_LABELS.has(label))
        return { subdomain: '', env: label };
    const cut = label.lastIndexOf('-');
    if (cut <= 0)
        return null;
    const subdomain = label.slice(0, cut);
    const env = label.slice(cut + 1);
    if (!ENV_LABELS.has(env) || !KNOWN_SUBS.has(subdomain))
        return null;
    return { subdomain, env };
}
/**
 * The first label a surface is served under in `env`. An empty `env` is the unadorned form.
 *
 * One function, so that "what is a surface called on an environment" has exactly one definition
 * and `splitEnvLabel` above is its inverse. The apex surface (`subdomain: ''`) collapses to the
 * bare label rather than producing `-testnet`, which is not a legal DNS label.
 */
export function envLabel(subdomain, env) {
    if (!env)
        return subdomain;
    return subdomain ? `${subdomain}-${env}` : env;
}
//# sourceMappingURL=surfaces.js.map