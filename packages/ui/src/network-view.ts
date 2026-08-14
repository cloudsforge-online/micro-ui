/**
 * The in-place network view, as one factory instead of nineteen copies (micro-org#459).
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE REPORT THIS EXISTS FOR, in the owner's words:
 *
 *     "i see basically that in every page when you press testnet it take you to network page
 *      testet and if you switch product its reset to mainnet"
 *
 * Both halves are one defect with one cause. Under the combined view the `-testnet` WEB hostnames
 * are retired, so a surface that cannot re-point its own reads has nowhere to send a reader who
 * presses Testnet. The previous answer was an escape route — navigate to Forge Network on testnet
 * — which is a worse answer than the bug: the reader asked to see THIS page on testnet and got a
 * different product. And leaving from a page that cannot view meant arriving at one that could,
 * from which every onward product link went back to a page that could not, which is the "switch
 * product and it resets" half.
 *
 * The fix is not a better escape route. It is that every bundle gains the in-place view, so there
 * is nothing to escape from. Three bundles already had one — `hub-web`, `explorer-web`,
 * `network-site` — each a ~90–190 line module that is nine-tenths the same code and ten-tenths
 * the same reasoning. Copying it sixteen more times would have guaranteed sixteen slightly
 * different answers to `?net=mainnet` on a mainnet page. This is that module, once.
 *
 * ── THE THREE PROPERTIES, WHICH ARE THE WHOLE SAFETY ARGUMENT ─────────────────────────────────
 *
 *   1. **Nothing is persisted.** Module state, in memory, per tab. The estate's no-stored-network
 *      invariant exists because a stored default once made the MAINNET explorer look up pasted
 *      hashes on a halted testnet and tell readers their real transactions did not exist. An
 *      in-memory choice made by a click on this page load cannot survive anything.
 *   2. **The default is the hostname's own network.** Until the reader touches the switcher this
 *      module is invisible and every answer is the one the address bar implies.
 *   3. **The viewed network is always on screen.** `CloudsForgeBar` shows the selection and
 *      `TestnetBand` follows it, so testnet data under a mainnet address bar wears the amber band.
 *
 * ── AND `?net=` IS WHAT CARRIES IT BETWEEN PRODUCTS ───────────────────────────────────────────
 *
 * Every surface is its own ORIGIN, so the module state below stops at the hostname. `?net=` is the
 * one channel that survives a cross-origin navigation without being storage: it is READ once at
 * load by {@link createNetworkView} and written by nobody, and `resolveProducts` attaches it to
 * the switcher's links. It survives the retirement redirect too — `market-testnet.<apex>` 302s to
 * `market.<apex>` preserving path and query.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

import {
  cloudsforgeHosts,
  currentNetwork,
  networkFromQuery,
  networkOrigin,
  type CloudsForgeHosts,
} from './index.tsx'
import { envLabel, surface, type SurfaceKey } from './surfaces.ts'

export type ViewedNetwork = 'mainnet' | 'testnet'

/**
 * Surfaces that stay on the estate SERVING the page, whatever the reader is viewing.
 *
 *   `nimbus`, `account`, `signin` — identity. The reader's token was minted by the estate serving
 *      this page and is refreshed there; sending a refresh to the other estate would ask a service
 *      that did not mint the session to extend it. One identity is the PREMISE of the combined
 *      view, not something it re-points per switch.
 *   `lantern` — the observability ingest. Telemetry is about THIS running bundle on THIS
 *      deployment, so it belongs to the estate serving the page regardless of what the reader is
 *      looking at. Filing a mainnet bundle's errors under testnet would make both estates' error
 *      rates fiction.
 *
 * Everything else a bundle reads is the chain's own state or the reader's own money, and both of
 * those are properties of the NETWORK.
 *
 * This is a default, not a law: `lantern-web` IS the observability surface, so for that one bundle
 * `lantern` is the thing being viewed rather than the thing reporting, and it passes its own list.
 */
export const NETWORK_PINNED_SURFACES: readonly SurfaceKey[] = ['nimbus', 'account', 'signin', 'lantern']

export interface NetworkView {
  /** The network the reader is viewing: their in-tab choice, or the hostname's own. */
  viewedNetwork(): ViewedNetwork
  /** Record the reader's choice. Choosing the hostname's own network clears the override. */
  setViewedNetwork(network: ViewedNetwork): void
  /**
   * The API origin for the viewed network: `''` for the deployment's own — requests stay relative,
   * which is the contract every `resolveApiBase` keeps — and the sibling estate's origin otherwise.
   *
   * This answers for THIS surface. A bundle whose API lives on a different hostname than the page
   * (aetherholm-web reads the worlds API) wants {@link NetworkView.viewedHosts} instead.
   */
  viewedApiOrigin(): string
  /** The base URL of ONE other surface on the viewed network. Pinned keys answer their own estate. */
  viewedSurfaceUrl(key: SurfaceKey): string
  /**
   * The whole host map, re-pointed at the viewed network — the drop-in for `hosts()` in a bundle's
   * `apiBase()` and in every cross-surface link it composes.
   *
   * Byte-identical to the map it is given when no network is being viewed, which is what makes the
   * one-word change at each call site safe in dev, in a preview deployment and on the apex.
   */
  viewedHosts(): CloudsForgeHosts
}

export interface NetworkViewOptions {
  /**
   * The bundle's own `hosts()`, when it is not simply `cloudsforgeHosts`.
   *
   * Measured 2026-08-14: it is a bare `return cloudsforgeHosts()` in fifteen of the nineteen
   * frontends, which is why this defaults rather than being required — a required argument here
   * would be fifteen imports whose only job is to reach the module this one already reads, and
   * `lib/hosts.ts` is precisely the module that wants to import THIS one back.
   */
  hosts?: () => CloudsForgeHosts
  /** Overrides {@link NETWORK_PINNED_SURFACES}. See that constant for when this is legitimate. */
  pinned?: readonly SurfaceKey[]
}

/**
 * Build one bundle's in-place network view. Call ONCE, at module scope, from `src/lib/viewed.ts`:
 *
 *     export const { viewedNetwork, setViewedNetwork, viewedApiOrigin } = createNetworkView()
 *
 * The `?net=` read happens here, at construction, which is why this must not be called per render:
 * a second instance would carry its own independent choice and the two would disagree.
 */
export function createNetworkView(options: NetworkViewOptions = {}): NetworkView {
  const hosts = options.hosts ?? cloudsforgeHosts
  const pinned = new Set<string>(options.pinned ?? NETWORK_PINNED_SURFACES)

  /**
   * The hostname's own network. `currentNetwork()` is null only off-registry (localhost, a bare
   * IP); mainnet is the safe reading there because localhost serves no testnet data either.
   */
  const deploymentNetwork = (): ViewedNetwork => currentNetwork() ?? 'mainnet'

  /**
   * The choice a link arrived carrying, read ONCE, at load, and written back nowhere.
   *
   * Normalised through the same rule as `setViewedNetwork`: `?net=mainnet` on a mainnet page is
   * agreement, not an override, and recording it as one would send this bundle's own reads out to
   * an absolute origin for no reason.
   *
   * Off-registry it answers null, and the check is `currentNetwork()` rather than
   * `deploymentNetwork()` deliberately. Localhost has no sibling estate — `NetworkSwitcher` hides
   * itself there, so no CLICK can produce an override — but a LINK can, and `deploymentNetwork()`
   * reads a development host as mainnet, so `?net=testnet` would have looked like a real choice
   * and pointed a dev bundle at the live testnet estate.
   */
  const fromLink = (): ViewedNetwork | null => {
    if (currentNetwork() === null) return null
    const asked = networkFromQuery()
    if (asked === null) return null
    return asked === deploymentNetwork() ? null : asked
  }

  let viewed: ViewedNetwork | null = fromLink()

  const viewedNetwork = (): ViewedNetwork => viewed ?? deploymentNetwork()

  const setViewedNetwork = (network: ViewedNetwork): void => {
    viewed = network === deploymentNetwork() ? null : network
  }

  const viewedApiOrigin = (): string => (viewed === null ? '' : networkOrigin(viewed))

  /**
   * The apex this page is served from, or null when this hostname is not one the composition
   * understands.
   *
   * Composing an address for another estate means claiming to know how THIS estate is named, and
   * that claim is wrong on more hostnames than it looks. A preview deployment at `pr-42.example.dev`
   * has three labels and a first label that is not an environment, so every naive rule strips it —
   * and `cloudsforgeHosts()` deliberately does not, because a preview host is its own apex. The
   * first version of this in `hub-web` stripped it and produced `https://pay-testnet.example.dev`,
   * an address that resolves nowhere: a link that fails tells the reader the service is gone rather
   * than that the page is confused.
   *
   * So the rule is CHECKED rather than enumerated — see `viewedSurfaceUrl` below.
   */
  const pageApex = (): string | null => {
    if (typeof window === 'undefined') return null
    const host = window.location.hostname
    const parts = host.split('.')
    if (parts.length < 2) return null
    return parts.length === 2 ? host : parts.slice(1).join('.')
  }

  const viewedSurfaceUrl = (key: SurfaceKey): string => {
    const own = hosts()[key]
    // No override, a pinned surface, or off-registry: the estate serving this page, resolved
    // exactly as every other caller resolves it. `NetworkSwitcher` hides itself off-registry, so a
    // non-null `viewed` there means something upstream is confused and the safe answer is not to
    // move.
    if (viewed === null || pinned.has(key)) return own
    const here = currentNetwork()
    if (here === null) return own
    const apex = pageApex()
    if (apex === null) return own
    const s = surface(key)
    // `envLabel` composes `hub` + `testnet` as `hub-testnet`, never `hub.testnet`. That is not
    // cosmetic: the edge's Universal SSL certificate is a wildcard over ONE label of the apex, so
    // the nested form fails the TLS handshake before a request is ever made.
    const compose = (network: ViewedNetwork): string => {
      const label = envLabel(s.subdomain, network === 'testnet' ? 'testnet' : '')
      return `https://${label ? `${label}.${apex}` : apex}${s.basePath ?? ''}`
    }
    // THE SELF-CHECK. Compose for the network the page is already on; if that does not reproduce
    // `hosts()` exactly, this hostname is not one the composition understands and the answer is
    // the serving estate. One check stands in for every hostname shape that would otherwise need
    // a branch here.
    if (compose(here) !== own) return own
    return compose(viewed)
  }

  const viewedHosts = (): CloudsForgeHosts => {
    const own = hosts()
    if (viewed === null) return own
    const out = { ...own } as Record<string, string>
    for (const key of Object.keys(own)) out[key] = viewedSurfaceUrl(key as SurfaceKey)
    return out as CloudsForgeHosts
  }

  return { viewedNetwork, setViewedNetwork, viewedApiOrigin, viewedSurfaceUrl, viewedHosts }
}
