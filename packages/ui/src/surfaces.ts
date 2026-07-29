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

/** Surfaces a person chooses between: the five products. */
export type ProductKey = 'network' | 'trade' | 'create' | 'market' | 'worlds'

/** Everything that may appear in the product switcher, products plus the operator tools. */
export type SwitcherKey = ProductKey | 'admin' | 'lantern' | 'beacon'

/** Every addressable CloudsForge surface, including the ones with no UI of their own. */
export type SurfaceKey =
  | SwitcherKey
  | 'hub'
  | 'site'
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
 * The five validated product accents, in switcher order.
 *
 * Exported so the guard test can assert that no product in the registry wears anything else.
 * That test is the mechanism that stops a sixth orange being added by hand, which is exactly how
 * the previous palette reached five oranges out of six accents.
 */
export const PRODUCT_ACCENTS = ['#d6412f', '#2a9e93', '#b28e1e', '#9b7bf0', '#6d9a49'] as const

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
  /* --- the five products, in the validated separation order ---------- */
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
    devPort: 3002,
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
    devPort: 8080,
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
    // The same service as Nimbus on a second hostname: `nimbus.` is what issues tokens,
    // `account.` is where a person is sent to sign in. Both rows exist so neither meaning has to
    // be inferred from a string at a call site.
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

/** Everything the switcher may show, in order: the five products, then the operator tools. */
export const SWITCHER_SURFACES: readonly CloudsForgeSurface[] = SURFACES.filter((s) => s.inSwitcher)

/** Subdomain prefixes stripped when deriving the apex from a browser hostname. */
export const KNOWN_SUBS: ReadonlySet<string> = new Set(
  SURFACES.map((s) => s.subdomain)
    .filter(Boolean)
    .concat('www'),
)
