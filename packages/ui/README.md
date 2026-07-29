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

## Development

```
pnpm install
pnpm typecheck
pnpm test        # node:test, no DOM: the pure parts are tested thoroughly
pnpm build       # tsc to dist/, then the two stylesheets are copied in
```
