# @cloudsforge/ui

The CloudsForge design system: the tokens, the shared account chrome, the brand marks and the
chart primitives. It is what makes seven separately deployed surfaces read as one company.

It supersedes the `@cloudsforge/ui` in `shared-libs`, and folds in the surface registry that used
to live in `@cloudsforge/shared/products`.

## What is in it

| Module | Import | What it is |
| --- | --- | --- |
| Tokens | `@cloudsforge/ui/tokens.css` | The three-layer custom-property system |
| Styles | `@cloudsforge/ui/ui.css` | The `.cf-*` class set for the chrome and the charts |
| Chrome | `@cloudsforge/ui` | `CloudsForgeBar`, `ProductSwitcher`, `AccountMenu`, `CloudsForgeLogo`, `Mark` |
| SSO | `@cloudsforge/ui` | `cloudsforgeHosts`, `accountUrl`, `signInRedirect`, `signOutRedirect`, `consumeAuthCallback` |
| Registry | `@cloudsforge/ui/surfaces` | `SURFACES`, `PRODUCTS`, `SWITCHER_SURFACES`, `surface()` — no React, importable from a build script |
| Charts | `@cloudsforge/ui/charts` | `Sparkline`, `AreaChart`, `BarChart`, `StatTile`, `Delta`, `Meter` |

React 19 is a peer dependency. There is no chart library, and there will not be one.

## Consuming the CSS

Import both stylesheets once, at the root of the app, before your own:

```ts
import '@cloudsforge/ui/tokens.css'
import '@cloudsforge/ui/ui.css'
```

`tokens.css` declares custom properties only; `ui.css` is the component layer and depends on it.

## The two attributes that drive theming

Everything else follows from two attributes on `<html>`. An app should never restate a hex.

```html
<html data-cf-product="trade" data-cf-substrate="cool">
```

**`data-cf-product`** picks the accent. Valid values: `network`, `trade`, `create`, `market`,
`worlds`, `hub`, `site`, `admin`, `lantern`, `beacon`, `status`, `developers`. Every one of them
has an explicit block — a value with no block used to fall through to the company ember in
silence, which is how the operator console ended up wearing the company's colour by accident.

**`data-cf-substrate`** picks the ash ramp: `warm` (default) or `cool`, the same charred ash
pulled towards blue-grey for products about measurement rather than heat. It is the sanctioned
way to retint the page. Redeclaring the ash ramp at your own `:root` is not — that is what made
the shared bar seam against the page it sat on.

Then reference the semantic layer, never the raw ramps: `--cf-bg`, `--cf-bg-raised`, `--cf-fg`,
`--cf-fg-dim`, `--cf-fg-mute`, `--cf-line`, `--cf-surface`, `--cf-accent`.

## Rules the package enforces rather than documents

- **Ember is company chrome, never a product accent.** It appears in exactly three places: the
  logo mark, the sign-in call to action and the bar's top seam.
- **There are five product accents**, and `surfaces.test.ts` fails if a sixth appears. The palette
  this replaced had six accents of which five were orange, the worst pair separated by ΔE 4.1
  under normal vision and ΔE 1.3 under protanopia.
- **Colour is never the only channel.** Every switcher entry ships a mark, a name and a blurb;
  every status ships an icon and a label.
- **An empty chart and a failed chart do not look the same.** "The query answered with nothing" is
  quiet; "the query did not answer" is loud, with an icon and a word as well as a colour.
- **Every chart has a `tableView` fallback**, which is the accessible, copyable and printable form.
- **No dual-axis charts, and no pie charts.** Two scales are two panels; allocation is sorted
  horizontal bars with direct labels, folding past eight into "Other".

## Specification

These are the two documents this package implements. Read them before changing a value here.

- `docs/ecosystem/assets/design-system.md` — substrate, accents, marks, the Hub layout and the
  accessibility rules.
- `docs/ecosystem/assets/chart-palette.md` — the categorical, sequential, diverging and status
  palettes, the mark and layout spec, and the anti-patterns.

Every colour in both was produced by the palette validator against the real panel surface
`#141110`. Reproduce any claim with:

```
node scripts/validate_palette.js "<hex,hex,…>" --mode dark --surface "#141110"
```

## Why the build output is in git

`dist/` is committed. That is unusual and it is deliberate.

Every consumer resolves this package as `link:../ui/packages/ui`, which symlinks **this working
tree**. Nothing on any consumer's path ever runs a build here — not their `pnpm install`, not their
Dockerfiles (which `COPY --from=uipkg packages/ui` out of a named build context), and not the
second checkout in each frontend's CI. So whatever is on disk here *is* what thirteen frontends
compile, bundle and ship.

While the entry points named `src/index.tsx`, that meant:

- **Every consumer transformed this package's TSX with its own toolchain.** Under `node --test`
  that is `tsx`, which applies the *consuming* repository's tsconfig; a sibling's sources match no
  `include`, so esbuild fell back to the **classic JSX transform** and emitted `React.createElement`
  into a module that imports no React. Eight frontends worked around it by installing a
  `globalThis.React` they should never have needed.
- **The artefact that would be published had never been executed.** `dist` was produced only by
  `prepack`, on a publish that has not happened, and `pnpm build` is not a step in this
  repository's CI. A build nobody has run is a build nobody knows works — the same shape that let
  `micro-service-template` ship a Docker image that could not boot.

The cost of committing output is that it can go stale, so that is what is asserted:
`src/dist.test.ts` recompiles `src/` on every `pnpm test`, into a directory beside `dist/`, and
fails if a single byte differs. It also fails if any `exports` entry names `./src` again, if the
emitter stops using the automatic JSX runtime, or if `publishConfig` grows a second entry-point map
that nothing compares against the first. The build therefore runs in CI, on every push, as part of
the suite.

**Editing the design system with a consumer open:** run `pnpm watch` here (`tsc --watch` into
`dist/`) and the consumer's dev server picks the change up as before. `pnpm watch` does not copy
the stylesheets — run `pnpm build` after a `.css` edit.

## Two Node-only subpaths

Neither is part of the browser surface. Both sit behind their own `exports` entry, and neither is
imported by `.`, `./charts` or `./surfaces`, so no bundle reaches them.

### `@cloudsforge/ui/test-loader` — one React under `node --test`

```
node --import tsx --import @cloudsforge/ui/test-loader --test test/*.test.ts
```

`link:` symlinks this working tree, and this working tree has its own `react` (a devDependency,
because `hosts.test.ts` and `charts.test.ts` import modules that import React). Node resolves bare
specifiers from a file's **realpath**, so the design system finds its own copy and the consumer
finds the consumer's — two dispatchers, and the shared chrome throws
`Cannot read properties of null (reading 'useState')` on its first hook.

**Publishing `dist` does not fix this**, and the prediction in eight repositories that it would is
wrong: it is true of a registry install, where devDependencies are not installed, and false of
`link:`. Measured against the built entry with no hook, `CloudsForgeLogo` renders and
`CloudsForgeBar`, `ProductSwitcher` and `AccountMenu` all throw. Vite has never needed it because
every consumer's `vite.config.ts` sets `resolve.dedupe: ['react', 'react-dom']`; this module is
that setting, supplied to the Node test loader.

It resolves the canonical copy from the **consumer's** `process.cwd()`, never from this package —
an app that pins a different React must not be silently rendered by the design system's.

### `@cloudsforge/ui/cite` — content pins that cannot rot quietly

```ts
import { cite, block, citeIfPresent } from '@cloudsforge/ui/cite'

const me = cite(at('../identity/src/server.ts'), "define('GET', '/auth/me'")
assert.match(block(me, 14), /user: toPublicUser\(user\)/, `GET /auth/me is at :${me.line}`)
```

A `path:line` citation decays silently — `micro-identity`'s route table moved 891 → 954 → 1000 in
one afternoon and turned three frontends red for a change none of them made. A content pin decays
differently, and both of its failure modes are worse, because a line pin at least fails loudly:
it can match text that has **moved somewhere it does not belong**, or match **nothing at all** and
still report a pass.

So the rule is that an anchor must match **exactly one** line. Zero throws; two throws and names
both. That one rule replaces every "anchors must be at least N characters" heuristic, because an
anchor loose enough to drift is an anchor that matches twice. A global or sticky RegExp is refused
outright (`/x/g.test()` carries `lastIndex` and silently skips every other line). A missing file
throws; `citeIfPresent` returns `null` for a sibling repository that is not checked out, which the
caller must turn into `t.skip()` — never `return`, which reports as a pass.

## Development

```
pnpm install
pnpm typecheck
pnpm test        # node:test, no DOM: the pure parts are tested thoroughly.
                 # This also RECOMPILES src/ and fails if dist/ is not its output.
pnpm build       # tsc to dist/, then the stylesheets are copied in. Commit the result.
pnpm watch       # tsc --watch into dist/, for editing with a consumer's dev server open
```
