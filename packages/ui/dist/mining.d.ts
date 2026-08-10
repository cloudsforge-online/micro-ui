/**
 * The sentence, spelled once.
 *
 * Present tense, no schedule, no number — `pool-web/src/lib/format.ts` set that standard and this
 * matches it rather than restating it in fourteen bundles. Exported so a consuming surface can
 * assert on the exact string instead of on a paraphrase of it.
 */
export declare const NOT_PAID_CLAUSE = "Shares are recorded against your account; nothing is paid out and there is no mechanism by which it could be.";
/** What the control is showing. See the header for what each one means and why. */
export type MiningPhase = 'unavailable' | 'signed-out' | 'idle' | 'mining' | 'elsewhere';
/**
 * The live figures, when there are live figures.
 *
 * Both are WORK, and there is deliberately no third field. `hashrate` is hashes per second as the
 * miner measured them over its own rolling window — never the pool's estimate, which is derived
 * from accepted shares and reads as zero for a browser that has not found one yet. `accepted` is
 * the count the pool acknowledged.
 */
export interface MiningReadout {
    readonly hashrate: number;
    readonly accepted: number;
}
export type MiningControlProps = {
    readonly phase: 'unavailable';
    /**
     * Why, in the reader's terms, as a full sentence. Required: a control that is refusing and
     * will not say what for is the state this component exists to stop rendering.
     */
    readonly reason: string;
    readonly payoutsImplemented?: boolean | undefined;
} | {
    readonly phase: 'signed-out';
    readonly onSignIn: () => void;
    readonly payoutsImplemented?: boolean | undefined;
} | {
    readonly phase: 'idle';
    readonly onStart: () => void;
    readonly payoutsImplemented?: boolean | undefined;
} | {
    readonly phase: 'mining';
    readonly onStop: () => void;
    readonly readout: MiningReadout;
    readonly payoutsImplemented?: boolean | undefined;
} | {
    readonly phase: 'elsewhere';
    /**
     * Where the miner actually runs. An absolute address resolved by the CALLER from
     * `cloudsforgeHosts()`, never composed here: this package is linked into fourteen bundles
     * each served from localhost, a preview host and the apex, and a literal would be right on
     * one of them.
     */
    readonly href: string;
    /** The surface's registry name, for the description. Never a second name written here. */
    readonly hostSurfaceName: string;
    readonly payoutsImplemented?: boolean | undefined;
};
/**
 * Hashes per second, at the precision a person reads rather than the precision the meter holds.
 *
 * Three significant figures and an SI step. A browser doing 412,318 H/s is doing "412 kH/s"; the
 * remaining digits change every second and carry nothing. Below 1 kH/s the raw count is shown,
 * because that is the range a machine that has only just started is in and rounding it to "0 kH/s"
 * would read as not working.
 */
export declare function formatHashrate(hashesPerSecond: number): string;
/**
 * The address of the page that hosts the miner, relative to Forge Hub's origin.
 *
 * Written ONCE. Thirteen surfaces link here, and thirteen copies of a path string is thirteen
 * chances for one of them to go on pointing at a route after it moves.
 */
export declare const HUB_MINE_PATH = "/mine";
/**
 * The props every surface that does NOT host the miner passes. One call, one line at the call
 * site, and the registry supplies the destination's name so it cannot disagree with the name in
 * the product switcher and in every footer.
 *
 * `hubUrl` is passed IN rather than resolved here. `cloudsforgeHosts()` lives in `index.tsx`, which
 * imports this module; reaching back for it would make a cycle, and every consuming app already
 * resolves its own `hosts()` for exactly this purpose.
 */
export declare function miningOnHub(hubUrl: string, payoutsImplemented?: boolean): MiningControlProps;
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
export declare function MiningControl(props: MiningControlProps): import("react").JSX.Element;
