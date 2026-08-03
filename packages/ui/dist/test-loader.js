/**
 * ONE REACT, FOR A CONSUMER RUNNING `node --test` AGAINST A `link:`ed DESIGN SYSTEM.
 *
 *     node --import tsx --import @cloudsforge/ui/test-loader --test test/*.test.ts
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS SHIPS FROM HERE, AND WHY PUBLISHING `dist` DID NOT MAKE IT UNNECESSARY
 *
 * Eight frontends carry a byte-identical copy of this file (`test/react-dedupe.ts` in
 * `micro-trade-web`, `micro-market-web`, `micro-mint-web`, `micro-worlds-web`,
 * `micro-status-web`, `micro-devportal-web`, `micro-explorer-web` and `micro-foresight-web`).
 * Each copy carries the same explanation, and each explanation ends with the same prediction: that
 * the workaround "vanishes the day `dist` is published".
 *
 * IT DOES NOT. That prediction is true only of a REGISTRY install, where npm does not install a
 * dependency's devDependencies. It is false of the arrangement the estate actually has, and will
 * have until the package is published:
 *
 *   - This package is consumed as `link:../ui/packages/ui`, which symlinks the WORKING TREE.
 *   - The working tree has its own `node_modules`, holding its own `react` and `react-dom` — they
 *     are devDependencies because `src/hosts.test.ts` and `src/charts.test.ts` import
 *     `./index.tsx` and `./charts.tsx`, both of which import `react` at module scope. Remove them
 *     and this package cannot test itself; it is not an accident that can be tidied away.
 *   - Node resolves a bare specifier from the REALPATH of the importing file. `dist/index.js` has
 *     the same realpath as `src/index.tsx`, so it finds the same second copy of React.
 *
 * Measured, not assumed. From `micro-trade-web`, against the built entry point, with no hook:
 *
 *     CloudsForgeLogo   RENDER OK len 593          ← no hooks, so one copy is enough
 *     CloudsForgeBar    TypeError: Cannot read properties of null (reading 'useState')
 *     ProductSwitcher   TypeError: Cannot read properties of null (reading 'useState')
 *     AccountMenu       TypeError: Cannot read properties of null (reading 'useState')
 *
 * So the two workarounds have two different causes and only one of them is a packaging defect.
 * The classic-JSX one was: it existed because the entry point named `src/index.tsx` and each
 * consumer transformed this package's TSX under its own tsconfig, and it is gone. This one is a
 * property of `link:` plus Node's realpath resolution, and the honest fix is not to make each
 * consumer write the same forty lines — it is for the package that owns the second copy of React
 * to own the deduplication too.
 *
 * `vite` never needed this: `resolve.dedupe: ['react', 'react-dom']` in every consumer's
 * `vite.config.ts` does the same job for `pnpm dev` and `pnpm build`. This file is that setting,
 * supplied to the Node test loader, which has no deduplication of its own.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * ── Which copy wins ───────────────────────────────────────────────────────────────────────────
 *
 * The CONSUMER's, resolved from `process.cwd()` — not this package's, resolved from
 * `import.meta.url`. Both would collapse the two copies into one and both would make the hooks
 * work today, because the two copies are the same version. They stop being equivalent the moment
 * they are not: an app pinning react 19.3 must not have its own components silently rendered by
 * the design system's 19.2. The app's React is the app's React, and a shared library that quietly
 * substitutes its own is a worse defect than the one being fixed.
 */
import module, { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
/**
 * The specifiers a React 19 tree reaches for.
 *
 * `react/jsx-runtime` and `react/jsx-dev-runtime` matter as much as `react` itself: a component
 * compiled with the automatic runtime never imports `react` at all, so a map that redirected only
 * the bare package would collapse the hooks and leave the element factory split.
 */
export const REACT_SPECIFIERS = [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/client',
    'react-dom/server',
    'react-dom/test-utils',
];
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
export function canonicalReact(options = {}) {
    const from = options.from ?? process.cwd();
    // `createRequire` wants a file, not a directory; the filename is never opened.
    const require = createRequire(join(from, 'noop.cjs'));
    const canonical = new Map();
    for (const specifier of REACT_SPECIFIERS) {
        try {
            canonical.set(specifier, pathToFileURL(require.resolve(specifier)).href);
        }
        catch {
            if (specifier === 'react') {
                throw new Error(`@cloudsforge/ui/test-loader: no 'react' resolvable from ${from}. It deduplicates the ` +
                    'copy this design system carries onto the one the consuming repository owns, and ' +
                    'there is no such copy here. Pass { from } if the test process runs somewhere other ' +
                    'than the repository root.');
            }
        }
    }
    return canonical;
}
/** Whether {@link installReactDedupe} has already registered its hook in this process. */
let installed = false;
/**
 * Register the resolve hook. Returns the map it installed, so a caller can assert on it.
 *
 * Calling twice is a no-op rather than a second hook: `--import` plus a stray `import` of this
 * module in a test file would otherwise stack two identical hooks, and the second would only ever
 * see specifiers the first had already short-circuited — dead code that reads as configuration.
 */
export function installReactDedupe(options = {}) {
    const canonical = canonicalReact(options);
    if (installed)
        return canonical;
    const registerHooks = module.registerHooks;
    if (typeof registerHooks !== 'function') {
        // Loud rather than silent. Without the hook the suite does not fail with a wrong answer, it
        // fails with a confusing one, and a harness that quietly degrades is worse than no harness.
        throw new Error(`@cloudsforge/ui/test-loader: node:module.registerHooks is unavailable (Node ${process.version}). ` +
            'It landed in 22.15 and this package requires >=22. Without it the linked design system ' +
            'loads a second copy of React and every rendered scenario fails with "Cannot read ' +
            "properties of null (reading 'useState')\".");
    }
    registerHooks({
        resolve(specifier, context, next) {
            const url = canonical.get(specifier);
            if (url !== undefined)
                return { url, shortCircuit: true };
            return next(specifier, context);
        },
    });
    installed = true;
    return canonical;
}
// The side effect is the point: `--import @cloudsforge/ui/test-loader` runs this module for its
// effect and never touches an export.
installReactDedupe();
//# sourceMappingURL=test-loader.js.map