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
import { NETWORK_QUERY_PARAM, cloudsforgeHosts, currentNetwork, networkFromQuery, networkOrigin, } from "./index.js";
import { envLabel, surface } from "./surfaces.js";
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
export const NETWORK_PINNED_SURFACES = ['nimbus', 'account', 'signin', 'lantern'];
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
export function keepNetworkInTheAddressBar(read) {
    if (typeof window === 'undefined' || !window.history)
        return () => undefined;
    const patchable = window;
    const history = window.history;
    const rawReplace = typeof history.replaceState === 'function' ? history.replaceState.bind(history) : null;
    if (rawReplace === null)
        return () => undefined;
    const rawPush = typeof history.pushState === 'function' ? history.pushState.bind(history) : null;
    /** The address bar, made to agree with `read()` — and left completely alone when it already does. */
    const sync = () => {
        // Off-registry (localhost, a bare IP, a preview host) nothing may be written. `fromLink` makes
        // the same refusal on the way in — it will not read `?net=` where there is no sibling estate —
        // so writing one here would put a parameter in the address bar that the next load ignores, and
        // an address bar that disagrees with the page is the failure this whole module exists to end.
        if (currentNetwork() === null)
            return;
        const { pathname, search, hash } = window.location;
        const params = new URLSearchParams(search);
        const viewed = read();
        if (viewed === null) {
            if (!params.has(NETWORK_QUERY_PARAM))
                return;
            params.delete(NETWORK_QUERY_PARAM);
        }
        else {
            if (params.get(NETWORK_QUERY_PARAM) === viewed)
                return;
            params.set(NETWORK_QUERY_PARAM, viewed);
        }
        const query = params.toString();
        // `history.state` is carried through untouched: react-router keeps its own location key there,
        // and replacing it with null makes the router lose its place on the next Back.
        rawReplace(history.state ?? null, '', `${pathname}${query ? `?${query}` : ''}${hash}`);
    };
    if (!patchable.__cfNetworkInTheAddressBar) {
        patchable.__cfNetworkInTheAddressBar = true;
        if (rawPush !== null) {
            history.pushState = (state, title, url) => {
                rawPush(state, title, url);
                sync();
            };
        }
        history.replaceState = (state, title, url) => {
            rawReplace(state, title, url);
            sync();
        };
        // Back and Forward move the address bar without either writer running. The reader's choice is
        // still the choice — they navigated within the tab, they did not un-press the switcher — so the
        // parameter goes back on the restored URL rather than the restored URL changing the view.
        if (typeof window.addEventListener === 'function')
            window.addEventListener('popstate', sync);
    }
    return sync;
}
/**
 * Build one bundle's in-place network view. Call ONCE, at module scope, from `src/lib/viewed.ts`:
 *
 *     export const { viewedNetwork, setViewedNetwork, viewedApiOrigin } = createNetworkView()
 *
 * The `?net=` read happens here, at construction, which is why this must not be called per render:
 * a second instance would carry its own independent choice and the two would disagree.
 */
export function createNetworkView(options = {}) {
    const hosts = options.hosts ?? cloudsforgeHosts;
    const pinned = new Set(options.pinned ?? NETWORK_PINNED_SURFACES);
    /**
     * The hostname's own network. `currentNetwork()` is null only off-registry (localhost, a bare
     * IP); mainnet is the safe reading there because localhost serves no testnet data either.
     */
    const deploymentNetwork = () => currentNetwork() ?? 'mainnet';
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
    const fromLink = () => {
        if (currentNetwork() === null)
            return null;
        const asked = networkFromQuery();
        if (asked === null)
            return null;
        return asked === deploymentNetwork() ? null : asked;
    };
    let viewed = fromLink();
    /**
     * The address bar, kept saying what the reader is viewing — see
     * {@link keepNetworkInTheAddressBar} for why a reload used to undo the switch, and why the write
     * happens here rather than in nineteen routers.
     *
     * Called once now: it installs the wrappers, and it makes the URL agree with a choice that
     * arrived by link. That first call writes nothing in the ordinary cases — the parameter is
     * already there when a link carried one, and absent when it did not.
     */
    const syncAddressBar = keepNetworkInTheAddressBar(() => viewed);
    syncAddressBar();
    const viewedNetwork = () => viewed ?? deploymentNetwork();
    const setViewedNetwork = (network) => {
        viewed = network === deploymentNetwork() ? null : network;
        syncAddressBar();
    };
    const viewedApiOrigin = () => (viewed === null ? '' : networkOrigin(viewed));
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
    const pageApex = () => {
        if (typeof window === 'undefined')
            return null;
        const host = window.location.hostname;
        const parts = host.split('.');
        if (parts.length < 2)
            return null;
        return parts.length === 2 ? host : parts.slice(1).join('.');
    };
    const viewedSurfaceUrl = (key) => {
        const own = hosts()[key];
        // No override, a pinned surface, or off-registry: the estate serving this page, resolved
        // exactly as every other caller resolves it. `NetworkSwitcher` hides itself off-registry, so a
        // non-null `viewed` there means something upstream is confused and the safe answer is not to
        // move.
        if (viewed === null || pinned.has(key))
            return own;
        const here = currentNetwork();
        if (here === null)
            return own;
        const apex = pageApex();
        if (apex === null)
            return own;
        const s = surface(key);
        // `envLabel` composes `hub` + `testnet` as `hub-testnet`, never `hub.testnet`. That is not
        // cosmetic: the edge's Universal SSL certificate is a wildcard over ONE label of the apex, so
        // the nested form fails the TLS handshake before a request is ever made.
        const compose = (network) => {
            const label = envLabel(s.subdomain, network === 'testnet' ? 'testnet' : '');
            return `https://${label ? `${label}.${apex}` : apex}${s.basePath ?? ''}`;
        };
        // THE SELF-CHECK. Compose for the network the page is already on; if that does not reproduce
        // `hosts()` exactly, this hostname is not one the composition understands and the answer is
        // the serving estate. One check stands in for every hostname shape that would otherwise need
        // a branch here.
        if (compose(here) !== own)
            return own;
        return compose(viewed);
    };
    const viewedHosts = () => {
        const own = hosts();
        if (viewed === null)
            return own;
        const out = { ...own };
        for (const key of Object.keys(own))
            out[key] = viewedSurfaceUrl(key);
        return out;
    };
    return { viewedNetwork, setViewedNetwork, viewedApiOrigin, viewedSurfaceUrl, viewedHosts };
}
//# sourceMappingURL=network-view.js.map