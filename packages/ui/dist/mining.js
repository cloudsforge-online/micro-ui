import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * `MiningControl` — the one control that offers browser mining, in the bar, on every surface.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS IS IN THE DESIGN SYSTEM AND NOT ON THE MINING PAGE
 *
 * Browser mining exists (`hub-web/src/mining/pool-miner.ts`, `pool/src/wsstratum.ts`) and the only
 * way to reach it is to already be on Forge Hub, know that `/mine` is an address, and scroll a
 * 1,081-line page to a Start button below the chain picker. A reader on Forge Market, on the
 * explorer, or on the status page has no route to it at all and no reason to believe there is one.
 *
 * So the control moves into the shared bar, beside the account menu, on every surface that renders
 * `CloudsForgeBar`. That is the estate's only piece of chrome present on every address of every
 * bundle, which makes it the only place a control can be put ONCE and be everywhere.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * IT NEVER IMPLIES A PAYMENT, AND THAT IS ENFORCED BY THE TYPE AS WELL AS BY THE COPY
 *
 * `pool/src/payouts.ts`: "PAYOUTS ARE OFF. THIS FILE NOW CONTAINS A REAL SINK, AND TWO INDEPENDENT
 * GATES REFUSE IT." `payoutsImplemented` is derived by the service and is false on this estate
 * today. `pool-web/src/components/notices.tsx` states the standard this control has to match: the
 * statement is present tense, carries no schedule, and is ACCOMPANIED BY NO NUMBER — "not zeroed
 * and not greyed out, because a zero reads as 'not yet, but soon' and the truth is 'not at all'".
 *
 * Mechanically, here:
 *
 *   * there is no prop for an amount, a balance, a projection or a currency, so a caller cannot
 *     pass one — the same technique `SignInIntent`'s non-empty tuple uses to make "sign in to
 *     continue" fail to compile;
 *   * the two figures it will render are `hashrate` (hashes per second, MEASURED by the miner) and
 *     `accepted` (shares the pool acknowledged). Both are work. Neither is money;
 *   * when `payoutsImplemented` is false the description carries {@link NOT_PAID_CLAUSE}, and
 *     `mining.test.ts` asserts both its presence and the absence of every currency mark and every
 *     earnings word from the whole rendered string.
 *
 * `payoutsImplemented` defaults to FALSE — the honest default and the one that survives a caller
 * who has not asked the service yet, which includes every surface that does not talk to the pool
 * at all. A surface that wants the clause gone has to be able to prove it.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE FIVE STATES, AND WHY THE MINER IS NOT IN THIS PACKAGE
 *
 * A browser mining session is a WebSocket to the pool plus two Web Workers grinding scrypt. It
 * lives on one origin and one page. `hub.<apex>` and `market.<apex>` are different origins; nothing
 * on the second can observe, start or stop a session on the first, and no amount of shared code
 * changes that. Inventing a cross-origin channel to fake one would be a lie about where the work is
 * happening.
 *
 * So the control is honest about the split instead:
 *
 *   `unavailable`  the deployment publishes no browser endpoint, or this device cannot mine. Named
 *                  reason, `aria-disabled` rather than `disabled` so it stays reachable and the
 *                  reason is announced instead of the control silently skipping the tab order.
 *   `signed-out`   a press signs you in. The pool mints a ticket against an estate session
 *                  (`POST /v1/pool/ticket`); there is nothing to start without one.
 *   `idle`         signed in, not mining, and this surface hosts the miner. A press starts it.
 *   `mining`       running here. The trigger carries the measured rate and the accepted count.
 *   `elsewhere`    the miner does not run from HERE. Renders an ANCHOR to the address that hosts
 *                  it, so it can be middle-clicked, opened in a new tab and read by every check
 *                  that reads links — the argument `accountSettingsUrl` makes.
 *
 * Thirteen of the fourteen surfaces render `elsewhere`. That is the correct answer for them and
 * not a degraded one: the reader is told the control exists, told where it works, and taken there.
 * Since micro-org#362 Forge Hub renders it too, for a different reason and with a `reason` on it —
 * see {@link MiningSubject} below, and `hub-web/src/mining/bar.ts` for the case.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TWO SUBJECTS, BECAUSE THE POOL CLAUSE IS TRUE OF THE POOL AND FALSE OF EMBER
 *
 * Until micro-org#362 every state of this control described the CloudsForge pool, and that was
 * accurate because the pool was the only thing a press could start. Forge Hub's bar now starts
 * EMBER — the estate's own chain, mined directly against the network — for an account with a
 * watched custodial EMBER deposit address, and two sentences that were true stop being true:
 *
 *   * "Mine for the CloudsForge pool" names the wrong thing. EMBER does not go through the pool
 *     at all; `pool/src/chains.ts` refuses to run one for it.
 *   * {@link NOT_PAID_CLAUSE} — "nothing is paid out and there is no mechanism by which it could
 *     be" — is exactly right about pool shares and exactly wrong about EMBER. A block this browser
 *     finds is paid on chain to a key the tab holds and swept to the account's own deposit
 *     address, where the estate's ordinary deposit path books it (`hub-web/src/lib/embersweep.ts`).
 *     There IS a mechanism; it ran for the first time on mainnet on 2026-08-10, at block 10,919.
 *
 * So the copy takes a SUBJECT rather than being weakened for both. `pool` is the default and every
 * existing caller — all thirteen `miningOnHub()` surfaces included — keeps the sentence it had,
 * clause and all. `ember` gets {@link EMBER_CREDITED_CLAUSE}, which says the true thing about the
 * true mechanism. Neither clause is ever softened into a sentence that would cover both.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE GLYPH IS THE ESTATE'S OWN RIDGE, AND THE SPARK IS THE ONLY THING THAT MOVES
 *
 * Every CloudsForge mark is drawn to one construction: a 24-unit viewBox, a ground line in
 * `--cf-fg-mute` (the ash ridge), and exactly ONE accent element. This glyph is that construction
 * at 16px — the ridge is always there, and a single spark sits above it ONLY while the machine is
 * actually contributing. Nothing animates and nothing is invented: there is no pulsing dot, no
 * spinner and no fake sparkline over samples nobody supplied. The spark's presence is a change of
 * FORM, which is what lets the state read for somebody who separates none of the hues — the rule
 * `tokens.css` states and `StatusPill` exists to make structural.
 */
import { useId } from 'react';
import { surface } from "./surfaces.js";
/**
 * The sentence, spelled once.
 *
 * Present tense, no schedule, no number — `pool-web/src/lib/format.ts` set that standard and this
 * matches it rather than restating it in fourteen bundles. Exported so a consuming surface can
 * assert on the exact string instead of on a paraphrase of it.
 */
export const NOT_PAID_CLAUSE = 'Shares are recorded against your account; nothing is paid out and there is no mechanism by which it could be.';
/**
 * The other sentence, for the other subject. Never a replacement for {@link NOT_PAID_CLAUSE}.
 *
 * Present tense and no schedule, the same standard, and it is a statement about a mechanism that
 * exists rather than one that does not. It carries NO FIGURE for the same reason its neighbour
 * carries none, and for one more: the confirmation depth (EMBER's is 60, about fifteen minutes at
 * Hearth's fifteen-second target) is a consensus parameter, and a number restated in a design
 * system is a number that goes on being rendered after `contracts/packages/chain` changes it. The
 * mining page states the depth, next to the address, where a reader who wants it will look.
 */
export const EMBER_CREDITED_CLAUSE = 'Blocks this browser finds are sent to your own CloudsForge EMBER deposit address, and credited once the network has confirmed them.';
/**
 * Hashes per second, at the precision a person reads rather than the precision the meter holds.
 *
 * Three significant figures and an SI step. A browser doing 412,318 H/s is doing "412 kH/s"; the
 * remaining digits change every second and carry nothing. Below 1 kH/s the raw count is shown,
 * because that is the range a machine that has only just started is in and rounding it to "0 kH/s"
 * would read as not working.
 */
export function formatHashrate(hashesPerSecond) {
    if (!Number.isFinite(hashesPerSecond) || hashesPerSecond <= 0)
        return '0 H/s';
    const STEPS = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s'];
    let value = hashesPerSecond;
    let step = 0;
    while (value >= 1000 && step < STEPS.length - 1) {
        value /= 1000;
        step += 1;
    }
    const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(step === 0 ? 0 : digits)} ${STEPS[step]}`;
}
/**
 * The address of the page that hosts the miner, relative to Forge Hub's origin.
 *
 * Written ONCE. Thirteen surfaces link here, and thirteen copies of a path string is thirteen
 * chances for one of them to go on pointing at a route after it moves.
 */
export const HUB_MINE_PATH = '/mine';
/**
 * The props every surface that does NOT host the miner passes. One call, one line at the call
 * site, and the registry supplies the destination's name so it cannot disagree with the name in
 * the product switcher and in every footer.
 *
 * `hubUrl` is passed IN rather than resolved here. `cloudsforgeHosts()` lives in `index.tsx`, which
 * imports this module; reaching back for it would make a cycle, and every consuming app already
 * resolves its own `hosts()` for exactly this purpose.
 */
export function miningOnHub(hubUrl, payoutsImplemented = false) {
    return {
        phase: 'elsewhere',
        href: `${hubUrl.replace(/\/+$/, '')}${HUB_MINE_PATH}`,
        hostSurfaceName: surface('hub').name,
        payoutsImplemented,
    };
}
/** The visible label. ONE WORD, THE SAME WORD, IN EVERY STATE — see below. */
const LABEL = 'Mine';
/**
 * The description each state carries, as an `aria-describedby` target rather than as the label.
 *
 * The label stays `Mine` throughout because the vocabulary of an interface is its signposting: a
 * control that renames itself between "Mine", "Start mining", "Stop mining" and "Mining" is four
 * controls to learn instead of one, and a reader scanning for the thing they pressed last time is
 * looking for a word that is no longer there. What changes is the PRESSED STATE (`aria-pressed`,
 * which a screen reader announces), the spark, and the figures.
 *
 * The sentence is a description and not the accessible NAME on purpose. Folding it into the name
 * would make the button announce as "Mine for the CloudsForge pool in this browser, shares are
 * recorded…" every time focus lands on it, which is a paragraph read aloud on every tab pass.
 *
 * ── THE CLAUSE IS CHOSEN BY THE SUBJECT, AND `payoutsImplemented` IS THE POOL'S FLAG ───────────
 *
 * `payoutsImplemented` comes from `GET /v1/pool` and describes the POOL. It is deliberately not
 * consulted for an EMBER subject: a pool that started paying out would not make an EMBER sweep any
 * more or less credited, and an EMBER state that dropped its clause because the pool's flag flipped
 * would be reading one system's answer about another system's question.
 */
function describe(props) {
    const paid = props.payoutsImplemented ?? false;
    const clause = paid ? '' : ` ${NOT_PAID_CLAUSE}`;
    const ember = ` ${EMBER_CREDITED_CLAUSE}`;
    switch (props.phase) {
        case 'unavailable':
            return `Browser mining is not available here. ${props.reason}`;
        case 'signed-out':
            // No subject. Nothing is known about the account before it has one, and which of the two a
            // press will start is a fact about the account — see `hub-web/src/mining/bar.ts`. The pool is
            // what this browser can always be told about truthfully, so it is what the invitation names.
            return `Sign in to mine for the CloudsForge pool in this browser.${clause}`;
        case 'idle':
            return props.subject === 'ember'
                ? `Mine EMBER against the CloudsForge network in this browser.${ember}`
                : `Mine for the CloudsForge pool in this browser.${clause}`;
        case 'mining':
            return props.subject === 'ember'
                ? `Mining EMBER against the CloudsForge network in this browser at ${formatHashrate(props.readout.hashrate)}, ` +
                    `${props.readout.accepted} blocks accepted. Press to stop.${ember}`
                : `Mining for the CloudsForge pool in this browser at ${formatHashrate(props.readout.hashrate)}, ` +
                    `${props.readout.accepted} shares accepted. Press to stop.${clause}`;
        case 'elsewhere': {
            const reason = props.reason === undefined ? '' : ` ${props.reason}`;
            /*
             * The EMBER arm carries NO clause, and that is the one place either clause is absent.
             * `EMBER_CREDITED_CLAUSE` promises that a found block reaches the account, and this is
             * precisely the state in which that cannot be promised — it is why the reader is being sent
             * somewhere instead of being offered a Start. The `reason` says what is missing; attaching
             * the promise underneath it would contradict it in the same breath.
             */
            return props.subject === 'ember'
                ? `Mine EMBER in your browser, on ${props.hostSurfaceName}.${reason}`
                : `Mine for the CloudsForge pool in your browser, on ${props.hostSurfaceName}.${clause}${reason}`;
        }
    }
}
/**
 * The ridge, and the spark that is only there when the machine is.
 *
 * `aria-hidden`, because the state is already carried by `aria-pressed`, by the description and —
 * for a sighted reader — by the figures beside it. A second announcement of the same fact is an
 * interruption, not an affordance.
 */
function Ridge({ lit }) {
    return (_jsxs("svg", { className: "cf-mine__ridge", width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", children: [_jsx("path", { className: "cf-mine__ridge-line", d: "M2 18 L8 11 L12 15 L16 9 L22 18" }), lit && (_jsx("path", { className: "cf-mine__spark", d: "M16 2.5 C17.4 4.2 18.1 5.5 18.1 6.6 C18.1 8 17.2 9 16 9 C14.8 9 13.9 8 13.9 6.6 C13.9 5.5 14.6 4.2 16 2.5 Z" }))] }));
}
/**
 * The control.
 *
 * A `<button>` for the three states that DO something and an `<a href>` for the one that is a
 * destination. That distinction is not cosmetic — `accountSettingsUrl`'s note records what it cost
 * the last time it was got wrong: an `onClick` destination cannot be middle-clicked, cannot be
 * opened in a new tab, its target cannot be copied, and it is invisible to every check that reads
 * links, which is why a wrong one survived on nineteen surfaces.
 *
 * `unavailable` uses `aria-disabled` rather than `disabled`. A `disabled` button is removed from
 * the tab order, so the one reader who most needs to be told WHY mining is refused is the one who
 * cannot reach the element carrying the reason.
 */
export function MiningControl(props) {
    const phase = props.phase;
    const mining = phase === 'mining';
    /*
     * `useId`, not a constant derived from the phase. Two controls on one page with the same id would
     * be a silently wrong `aria-describedby` rather than a visible break — the same argument
     * `SignInIntent` makes about its `aria-labelledby`, and asserted the same way.
     */
    const descriptionId = useId();
    const className = `cf-btn cf-mine cf-mine--${phase}`;
    const body = (_jsxs(_Fragment, { children: [_jsx(Ridge, { lit: mining }), _jsx("span", { className: "cf-mine__label", children: LABEL }), props.phase === 'mining' && (
            /*
              The measured rate, in the mono face with tabular figures — `.cf-num` — so a figure that
              changes every second does not shuffle the controls beside it on every change.
    
              `aria-hidden`, and NOT a live region. A rate that updates once a second in an `aria-live`
              element is a screen reader talking over the page continuously, forever; the same number is
              already in the description, where it is read when the reader asks for it by putting focus
              on the control. This is the one figure a sighted reader gets for free and a screen-reader
              user gets on request, which is the right way round.
            */
            _jsx("span", { className: "cf-mine__rate cf-num", "aria-hidden": "true", children: formatHashrate(props.readout.hashrate) }))] }));
    /*
     * OUTSIDE the control, and that placement is load-bearing.
     *
     * An element's accessible NAME is computed from its own descendants, `.cf-sr` included. Nesting
     * this span inside the button would make it announce as "Mine, Mining for the CloudsForge pool in
     * this browser at 412 kH/s, 9 shares accepted…" on every tab pass — the exact paragraph-as-a-name
     * that putting the sentence in a DESCRIPTION was meant to avoid. As a sibling it is a description
     * and only a description: read on request, never as part of the name.
     *
     * A `Fragment` rather than a wrapper element: the bar's row is a flex container, and an extra box
     * in it would take a gap. The span is `position: absolute` and 1px, so it occupies nothing.
     */
    const description = (_jsx("span", { className: "cf-sr", id: descriptionId, children: describe(props) }));
    if (props.phase === 'elsewhere') {
        return (_jsxs(_Fragment, { children: [_jsx("a", { className: className, href: props.href, "aria-describedby": descriptionId, children: body }), description] }));
    }
    const onClick = () => {
        if (props.phase === 'signed-out')
            props.onSignIn();
        else if (props.phase === 'idle')
            props.onStart();
        else if (props.phase === 'mining')
            props.onStop();
        // `unavailable` does nothing. The reason is already on the element.
    };
    return (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: className, "aria-describedby": descriptionId, ...(phase === 'unavailable' ? { 'aria-disabled': true } : {}), ...(phase === 'idle' || mining ? { 'aria-pressed': mining } : {}), onClick: onClick, children: body }), description] }));
}
//# sourceMappingURL=mining.js.map