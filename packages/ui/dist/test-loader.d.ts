/**
 * The specifiers a React 19 tree reaches for.
 *
 * `react/jsx-runtime` and `react/jsx-dev-runtime` matter as much as `react` itself: a component
 * compiled with the automatic runtime never imports `react` at all, so a map that redirected only
 * the bare package would collapse the hooks and leave the element factory split.
 */
export declare const REACT_SPECIFIERS: readonly string[];
export interface DedupeOptions {
    /**
     * The directory whose `node_modules` supplies the one true React. Defaults to `process.cwd()`,
     * which under `pnpm test` is the consuming repository's root.
     */
    readonly from?: string;
}
/**
 * Resolve every React specifier from `from`, as a map of specifier to `file://` URL.
 *
 * Specifiers that do not resolve are OMITTED rather than defaulted: `react-dom/test-utils` is gone
 * in React 19 and `react-dom/server` is absent from some installs, and a map entry pointing at a
 * file that is not there would turn a missing optional entry point into a resolution error in
 * code that never asked for it.
 *
 * `react` itself is different. If that does not resolve, the caller's assumption — that the
 * process it is about to run has a React — is already false, and continuing would produce the
 * confusing failure rather than the clear one.
 */
export declare function canonicalReact(options?: DedupeOptions): Map<string, string>;
/**
 * Register the resolve hook. Returns the map it installed, so a caller can assert on it.
 *
 * Calling twice is a no-op rather than a second hook: `--import` plus a stray `import` of this
 * module in a test file would otherwise stack two identical hooks, and the second would only ever
 * see specifiers the first had already short-circuited — dead code that reads as configuration.
 */
export declare function installReactDedupe(options?: DedupeOptions): Map<string, string>;
