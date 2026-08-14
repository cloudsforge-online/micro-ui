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
 *   1. **Nothing is stored — the choice lives in the address bar and in module memory.** The
 *      estate's no-stored-network invariant exists because a stored default once made the MAINNET
 *      explorer look up pasted hashes on a halted testnet and tell readers their real transactions
 *      did not exist. What that closed was a choice made once, invisibly, OUTLIVING the reader's
 *      intent. So there is no `localStorage`, no cookie and no server-side preference here: close
 *      the tab and the estate has forgotten. A switch does write `?net=` into the URL
 *      ({@link keepNetworkInTheAddressBar}), because otherwise F5 silently undid it — but that is
 *      the opposite of a stored default: it is on screen, it is scoped to the address it is part
 *      of, and opening any other address is already free of it.
 *   2. **The default is the hostname's own network.** Until the reader touches the switcher this
 *      module is invisible and every answer is the one the address bar implies.
 *   3. **The viewed network is always on screen.** `CloudsForgeBar` shows the selection and
 *      `TestnetBand` follows it, so testnet data under a mainnet address bar wears the amber band.
 *
 * ── AND `?net=` IS WHAT CARRIES IT BETWEEN PRODUCTS ───────────────────────────────────────────
 *
 * Every surface is its own ORIGIN, so the module state below stops at the hostname. `?net=` is the
 * one channel that survives a cross-origin navigation without being storage: it is READ at load by
 * {@link createNetworkView}, WRITTEN INTO THE ADDRESS BAR by {@link keepNetworkInTheAddressBar}
 * when the reader switches, and `resolveProducts` attaches it to the switcher's links. It survives
 * the retirement redirect too — `market-testnet.<apex>` 302s to `market.<apex>` preserving path
 * and query.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { type CloudsForgeHosts } from './index.tsx';
import { type SurfaceKey } from './surfaces.ts';
export type ViewedNetwork = 'mainnet' | 'testnet';
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
export declare const NETWORK_PINNED_SURFACES: readonly SurfaceKey[];
export interface NetworkView {
    /** The network the reader is viewing: their in-tab choice, or the hostname's own. */
    viewedNetwork(): ViewedNetwork;
    /** Record the reader's choice. Choosing the hostname's own network clears the override. */
    setViewedNetwork(network: ViewedNetwork): void;
    /**
     * The API origin for the viewed network: `''` for the deployment's own — requests stay relative,
     * which is the contract every `resolveApiBase` keeps — and the sibling estate's origin otherwise.
     *
     * This answers for THIS surface. A bundle whose API lives on a different hostname than the page
     * (aetherholm-web reads the worlds API) wants {@link NetworkView.viewedHosts} instead.
     */
    viewedApiOrigin(): string;
    /** The base URL of ONE other surface on the viewed network. Pinned keys answer their own estate. */
    viewedSurfaceUrl(key: SurfaceKey): string;
    /**
     * The whole host map, re-pointed at the viewed network — the drop-in for `hosts()` in a bundle's
     * `apiBase()` and in every cross-surface link it composes.
     *
     * Byte-identical to the map it is given when no network is being viewed, which is what makes the
     * one-word change at each call site safe in dev, in a preview deployment and on the apex.
     */
    viewedHosts(): CloudsForgeHosts;
}
/**
 * Put the viewed network in the ADDRESS BAR, and keep it there.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE REPORT, in the owner's words:
 *
 *     "if we have testnet selected and we refresh the page it goes to mainnet"
 *
 * Exactly so, and by construction: the choice was module memory and nothing else, and a reload
 * discards module memory. Property 1 above — nothing is persisted — was answering a question
 * nobody asked. The scar it guards is a choice made WEEKS AGO deciding, invisibly, that a pasted
 * mainnet hash does not exist. A reader pressing F5 on a page whose address says `?net=testnet` is
 * not that: the choice is on screen, in the one place a browser shows on every page, and it is
 * gone the moment they open a different address.
 *
 * So the rule tightens rather than loosening. The address bar must say what the reader is viewing:
 *
 *   - an override in force  →  `?net=` names it, so a RELOAD, a BOOKMARK and a COPIED LINK all
 *     reproduce what is on screen;
 *   - no override           →  no parameter at all, so the URL of a plain mainnet page is the URL
 *     it has always been, and `?net=mainnet` left over from a switch back is cleaned up.
 *
 * Still nothing is stored. There is no `localStorage`, no cookie and no server-side preference:
 * close the tab and the estate has forgotten. What changed is only that the choice is now written
 * where the reader can read it, which is strictly more honest than memory they cannot.
 *
 * ── WHY THIS PATCHES `history`, WHICH IS NOT A THING TO DO LIGHTLY ────────────────────────────
 *
 * Writing the parameter once, on the click, fixes a reload taken immediately and nothing else: the
 * router owns the address bar afterwards, and its very next `pushState` composes a path with no
 * idea this parameter exists. The reader switches to testnet, opens Wallet from the nav, refreshes
 * — and is on mainnet again, having done nothing wrong. That is the same defect one navigation
 * later, and it is the one they would actually hit.
 *
 * Nineteen bundles across four routers cannot each be taught to carry a query parameter without
 * nineteen chances to do it differently, and `@cloudsforge/ui` cannot import a router — several of
 * these surfaces have none. What every one of them DOES share is `window.history`. So the two
 * writers are wrapped: whatever the app meant to write is written first, unchanged, and then the
 * network is re-asserted in place with `replaceState`, which adds no entry and leaves the Back
 * button exactly as the app built it.
 *
 * The wrappers call the CAPTURED originals, never the patched pair, so nothing here can recurse.
 * Installed at most once per bundle, and never where there is no `window` (SSR, the test runners).
 *
 * @param read the current override — `null` when the reader is on the hostname's own network.
 * @returns the sync, to call after every change to what `read` answers.
 */
export declare function keepNetworkInTheAddressBar(read: () => ViewedNetwork | null): () => void;
export interface NetworkViewOptions {
    /**
     * The bundle's own `hosts()`, when it is not simply `cloudsforgeHosts`.
     *
     * Measured 2026-08-14: it is a bare `return cloudsforgeHosts()` in fifteen of the nineteen
     * frontends, which is why this defaults rather than being required — a required argument here
     * would be fifteen imports whose only job is to reach the module this one already reads, and
     * `lib/hosts.ts` is precisely the module that wants to import THIS one back.
     */
    hosts?: () => CloudsForgeHosts;
    /** Overrides {@link NETWORK_PINNED_SURFACES}. See that constant for when this is legitimate. */
    pinned?: readonly SurfaceKey[];
}
/**
 * Build one bundle's in-place network view. Call ONCE, at module scope, from `src/lib/viewed.ts`:
 *
 *     export const { viewedNetwork, setViewedNetwork, viewedApiOrigin } = createNetworkView()
 *
 * The `?net=` read happens here, at construction, which is why this must not be called per render:
 * a second instance would carry its own independent choice and the two would disagree.
 */
export declare function createNetworkView(options?: NetworkViewOptions): NetworkView;
