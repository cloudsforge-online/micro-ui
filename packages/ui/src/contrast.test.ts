/**
 * EVERY TEXT PAIR THIS PACKAGE SHIPS, MEASURED AGAINST WCAG AA, ON EVERY SUBSTRATE.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS FILE CLOSES
 *
 * `--cf-fg-mute` shipped at `#63757a` on the `cool` substrate and measured **3.54:1** against the
 * panel `#151d21` — under the 4.5:1 AA floor for normal text. It is the token behind secondary
 * labels, timestamps, chart axes, tile captions and the `<Mark>` ground line, so it was not one
 * screen's defect: it was every muted string on every surface that sets
 * `data-cf-substrate="cool"`.
 *
 * The design system did not notice, because nothing in it computed a ratio. The only thing that
 * could catch it was a per-frontend axe run, which sees a token exactly where a route happens to
 * paint it — three repositories recorded it as a known violation and three others carried an empty
 * exclusion list that would have gone red the moment they rendered the token. A contrast rule
 * belongs in the package that DEFINES the colours, once, rather than in fourteen browser suites
 * that each see a sixth of the surface area.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT IS MEASURED, AND WHY IT IS DERIVED RATHER THAN LISTED
 *
 * Nothing below is a colour somebody typed after looking at a screen, and nothing below is a list
 * of pairs somebody remembered to keep up to date. Both halves are read out of the stylesheets:
 *
 *   1. `tokens.css` is resolved the way a browser resolves it — every block whose selector matches
 *      a simulated `<html data-cf-substrate="…" data-cf-product="…">`, applied in source order,
 *      with `var()` chains and `color-mix(in srgb, …)` evaluated as specified. That is what makes
 *      the warm and the cool substrate two different answers from one file.
 *
 *   2. `ui.css` is read for every rule that sets `color`, and each one is paired with the ground
 *      it is actually painted on — the nearest enclosing BEM name that declares a `background`.
 *      `.cf-chart__tip-label` resolves to `.cf-chart__tip`, not to `.cf-chart`, because that is
 *      where it sits; `.cf-menu__label` resolves to `.cf-menu`; a class with no enclosing
 *      background at all falls through to the page.
 *
 * So a rule added to `ui.css` tomorrow is measured tomorrow, without anybody adding it here. That
 * is the only shape that closes this class of defect: a hand-maintained list of pairs is a list
 * that goes stale the first time somebody adds a panel, and a stale list reports a pass.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE THRESHOLD, AND WHY THERE IS ONLY ONE
 *
 * 4.5:1 for every text pair. WCAG 2.2 allows 3:1 for large text, and several of these rules are
 * large (`.cf-tile__value` is 25.6px at the default root size). They are held to 4.5 anyway,
 * because they are drawn in the SAME TOKENS as the body text, and a separate laxer budget for the
 * same colour is a budget nobody can apply correctly later — "restrict the muted token to large
 * text" was one of the honest options for fixing this defect and it was rejected for exactly that
 * reason. See the note in `tokens.css` beside `--cf-khaki`.
 *
 * 3:1 for the chart series colours against the chart surface, which is the WCAG floor for a
 * graphical object. The sequential ramp is deliberately NOT held to it — see the block below.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOW THIS FILE CAN FAIL TO BE A TEST
 *
 * A parser that reads nothing reports that nothing is broken. Three things guard against it: the
 * colour maths is checked against two ratios everybody knows, the resolver is asserted to produce
 * DIFFERENT answers for the two substrates, and the extraction is asserted to contain the specific
 * pairs this defect was found on. Delete a regex and the file goes red rather than quiet.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

/* ═══════════════════════════════════ the colour maths ═══════════════════════════════════ */

/** An 8-bit sRGB colour with straight (not premultiplied) alpha. */
interface Colour {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

function parseHex(hex: string): Colour {
  const value = hex.trim().replace('#', '')
  const full =
    value.length === 3 || value.length === 4
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  assert.ok(full.length === 6 || full.length === 8, `not a hex colour: ${hex}`)
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
  }
}

const toHex = (c: Colour): string =>
  `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

/** WCAG relative luminance: the sRGB transfer function, not a naive channel average. */
function luminance(c: Colour): number {
  const channel = (v: number): number => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/** WCAG contrast ratio: always ≥ 1, and order-independent. */
function contrast(a: Colour, b: Colour): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** CIE L*, used only where the question is "can a reader see these as two steps", not "AA". */
function lightness(c: Colour): number {
  const y = luminance(c)
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
}

/**
 * `color-mix(in srgb, <a> <p>%, <b>)`, as the browser computes it.
 *
 * sRGB mixing interpolates the ENCODED channel values, deliberately not the linearised ones, which
 * is why the stylesheet says `in srgb` and why this must too. Mixing in a linear space produces a
 * lighter result and would report a pass for something the browser paints differently.
 *
 * ── PREMULTIPLIED, AND THEN UN-PREMULTIPLIED, WHICH IS THE WHOLE ANSWER ────────────────────────
 *
 * This function used to interpolate the channels straight and say so:
 *
 *   "The second operand is very often `transparent`, which in `color-mix` is `rgb(0 0 0 / 0)` —
 *    so the alpha falls to `p%` AND THE RGB IS PULLED TOWARD BLACK."
 *
 * The first clause is right and the second is wrong. CSS Color 5 §color-mix interpolates in
 * PREMULTIPLIED space and converts back, so `color-mix(in srgb, white 6%, transparent)` is
 * `rgb(255 255 255 / 0.06)` — full-strength white at 6% alpha, not a 6%-grey at 6% alpha. Every
 * `--cf-line`, `--cf-line-strong`, `--cf-surface` and `--cf-surface-hover` in this system is that
 * form, so the error was not academic: the channels were being multiplied by the alpha here and
 * then multiplied by it AGAIN in `over`, and every alpha ground in the package resolved almost to
 * the opaque surface beneath it.
 *
 * What that cost, in the one place it was load-bearing. `--cf-surface-hover` is bone at 6% and the
 * hovered panel row is the TIGHTEST ground in the system — it is the ground `tokens.css` says the
 * cool ramp was renormalised against, at "4.569:1". This file computed that same pair at 5.19:1,
 * because it resolved the hovered row to `#141110` (the panel itself) rather than to `#211e1c`.
 * The derivation of `--cf-khaki` was done with the right maths OUTSIDE this file and the test that
 * was meant to hold it computed a different, laxer number — which is exactly the shape of defect
 * this package keeps finding elsewhere: the guard and the thing it guards had drifted apart, and
 * the guard was the one reporting a pass.
 *
 * It is fixed rather than pinned because a resolver that is 0.6 of contrast optimistic on every
 * alpha ground is a resolver that will wave through the next token too.
 */
function mixSrgb(a: Colour, percent: number, b: Colour): Colour {
  const f = percent / 100
  const alpha = a.a * f + b.a * (1 - f)
  if (alpha === 0) return TRANSPARENT
  // Interpolate premultiplied, then divide the alpha back out.
  const ch = (x: number, y: number): number => (x * a.a * f + y * b.a * (1 - f)) / alpha
  return { r: ch(a.r, b.r), g: ch(a.g, b.g), b: ch(a.b, b.b), a: alpha }
}

/** `src` composited over `dst`, the plain source-over rule, so an alpha ground becomes a colour. */
function over(src: Colour, dst: Colour): Colour {
  if (src.a >= 1) return src
  const a = src.a + dst.a * (1 - src.a)
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }
  const ch = (s: number, d: number): number => (s * src.a + d * dst.a * (1 - src.a)) / a
  return { r: ch(src.r, dst.r), g: ch(src.g, dst.g), b: ch(src.b, dst.b), a }
}

const TRANSPARENT: Colour = { r: 0, g: 0, b: 0, a: 0 }

/* ═════════════════════════════ reading tokens.css as a browser would ═════════════════════════ */

const TOKENS_CSS = stripComments(readFileSync(new URL('./tokens.css', import.meta.url), 'utf8'))
const UI_CSS = stripComments(readFileSync(new URL('./ui.css', import.meta.url), 'utf8'))

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

interface Rule {
  readonly selectors: readonly string[]
  readonly declarations: ReadonlyArray<readonly [property: string, value: string]>
}

/**
 * Every top-level rule in a stylesheet, in source order.
 *
 * Deliberately not a general CSS parser: it skips at-rules with a block (`@keyframes`, `@media`)
 * rather than descending into them, and asserts it found a plausible number of rules. Neither
 * stylesheet in this package puts a custom property or a `color` inside an at-rule, and the
 * assertion in `describe('the parser')` fails if that ever stops being true.
 */
function parseRules(css: string): Rule[] {
  const rules: Rule[] = []
  const re = /([^{}@]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = re.exec(css)) !== null) {
    const prelude = (match[1] ?? '').trim()
    if (prelude === '' || prelude.startsWith('@') || prelude.includes('}')) continue
    const declarations: Array<readonly [string, string]> = []
    for (const raw of (match[2] ?? '').split(';')) {
      const at = raw.indexOf(':')
      if (at === -1) continue
      const property = raw.slice(0, at).trim()
      const value = raw.slice(at + 1).trim()
      if (property !== '' && value !== '') declarations.push([property, value] as const)
    }
    rules.push({ selectors: prelude.split(',').map((s) => s.trim()), declarations })
  }
  return rules
}

/** The element the token cascade is being resolved for: `<html>`, wearing its two attributes. */
interface Scope {
  readonly substrate: 'warm' | 'cool'
  /** `null` for the default (no `data-cf-product`), which falls through to the company ember. */
  readonly product: string | null
  /** The one class scope the system declares: `.cf-dark`, for chrome inside a light host. */
  readonly dark?: boolean
}

/** Does this simple selector match the simulated `<html>`? */
function selectorMatches(selector: string, scope: Scope): boolean {
  const s = selector.trim()
  if (s === ':root') return true
  if (s === '[data-cf-substrate]') return true
  if (s === `[data-cf-substrate='${scope.substrate}']`) return true
  if (s.startsWith('[data-cf-substrate=')) return false
  if (s === '.cf-dark') return scope.dark === true
  const product = /^\[data-cf-product='([a-z-]+)'\]$/.exec(s)
  if (product) return product[1] === scope.product
  return false
}

/**
 * Every custom property, resolved for one scope.
 *
 * The cascade here is pure source order, and that is not an approximation: `:root`,
 * `[data-cf-substrate]`, `[data-cf-substrate='cool']` and `[data-cf-product='trade']` all have
 * specificity (0,1,0), so the later declaration wins. It is also the mechanism the file depends
 * on — the warm ramp is declared on `:root` and the cool ramp overrides it further down.
 */
function declaredTokens(scope: Scope): Map<string, string> {
  const out = new Map<string, string>()
  for (const rule of parseRules(TOKENS_CSS)) {
    if (!rule.selectors.some((s) => selectorMatches(s, scope))) continue
    for (const [property, value] of rule.declarations) {
      if (property.startsWith('--')) out.set(property, value)
    }
  }
  return out
}

/**
 * A declared value, resolved to a colour.
 *
 * Handles the four forms this system actually uses — a hex, `var(--x)` with an optional fallback,
 * `color-mix(in srgb, <a> <p>%, <b>)`, and `rgb()`/`rgba()` with an optional alpha — and throws on
 * anything else rather than guessing, so a new form is a red test and not a silent zero.
 */
function resolveColour(value: string, tokens: ReadonlyMap<string, string>, depth = 0): Colour {
  assert.ok(depth < 12, `custom property cycle while resolving: ${value}`)
  const v = value.trim()

  if (v === 'transparent') return TRANSPARENT
  if (v.startsWith('#')) return parseHex(v)

  const varMatch = /^var\(\s*(--[a-z0-9-]+)\s*(?:,([\s\S]+))?\)$/i.exec(v)
  if (varMatch) {
    const name = varMatch[1] ?? ''
    const declared = tokens.get(name)
    if (declared !== undefined) return resolveColour(declared, tokens, depth + 1)
    const fallback = varMatch[2]
    assert.ok(fallback !== undefined, `${name} is never declared and has no fallback`)
    return resolveColour(fallback, tokens, depth + 1)
  }

  const mixMatch = /^color-mix\(\s*in\s+srgb\s*,([\s\S]+)\)$/i.exec(v)
  if (mixMatch) {
    const [first, second] = splitTop(mixMatch[1] ?? '')
    const withPercent = /^([\s\S]+?)\s+(\d+(?:\.\d+)?)%$/.exec((first ?? '').trim())
    assert.ok(withPercent, `color-mix operand carries no percentage: ${first}`)
    return mixSrgb(
      resolveColour(withPercent[1] ?? '', tokens, depth + 1),
      Number(withPercent[2]),
      resolveColour((second ?? 'transparent').trim(), tokens, depth + 1),
    )
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(v)
  if (rgbMatch) {
    const parts = (rgbMatch[1] ?? '').split(/[\s,/]+/).filter((p) => p !== '')
    const [r, g, b, alpha] = parts
    return {
      r: Number(r),
      g: Number(g),
      b: Number(b),
      a: alpha === undefined ? 1 : alpha.endsWith('%') ? Number(alpha.slice(0, -1)) / 100 : Number(alpha),
    }
  }

  throw new Error(`unrecognised colour form, refusing to guess: ${v}`)
}

/** Split a comma list at depth zero, so a nested `color-mix(a, b)` is not cut in half. */
function splitTop(input: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const ch of input) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

/** Every colour stop in a `linear-gradient(…)`, ignoring the direction and any stop positions. */
function gradientStops(value: string, tokens: ReadonlyMap<string, string>): Colour[] {
  const inner = /^linear-gradient\(([\s\S]+)\)$/i.exec(value.trim())
  if (!inner) return []
  return splitTop(inner[1] ?? '')
    .map((part) => part.trim().replace(/\s+\d+(\.\d+)?%$/, ''))
    .filter((part) => !/^(to\b|\d+deg|\d+turn)/i.test(part))
    .map((part) => resolveColour(part, tokens))
}

/* ═══════════════════════════ reading ui.css: which ground is under what ═══════════════════════ */

/** The class this rule paints, e.g. `.cf-chart__tip-label:hover` → `cf-chart__tip-label`. */
function targetClass(selector: string): string | null {
  const classes = [...selector.matchAll(/\.(cf-[a-z0-9_-]+)/g)].map((m) => m[1] ?? '')
  return classes.at(-1) ?? null
}

/**
 * The BEM names a class sits inside, nearest first.
 *
 * `cf-chart__tip-label` → `cf-chart__tip-label`, `cf-chart__tip`, `cf-chart`. The middle step is
 * the one that matters: the tooltip label is painted on the TOOLTIP, which has its own surface,
 * not on the chart panel behind it. Resolving to the block alone would measure the wrong ground
 * and report a pass for a pair the browser paints differently.
 */
function enclosingNames(className: string): string[] {
  const modifier = className.indexOf('--')
  const base = modifier === -1 ? className : className.slice(0, modifier)
  const out = modifier === -1 ? [className] : [className, base]
  const split = base.indexOf('__')
  if (split === -1) return out
  const block = base.slice(0, split)
  let element = base.slice(split + 2)
  for (;;) {
    const dash = element.lastIndexOf('-')
    if (dash === -1) break
    element = element.slice(0, dash)
    out.push(`${block}__${element}`)
  }
  out.push(block)
  return out
}

interface Painted {
  /** The rule's selector, for the failure message. */
  readonly selector: string
  readonly className: string
  readonly property: 'color'
  readonly value: string
}

/** Every declared background in `ui.css`, keyed by the class that carries it. */
function backgroundsByClass(): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const rule of parseRules(UI_CSS)) {
    for (const [property, value] of rule.declarations) {
      if (property !== 'background' && property !== 'background-color') continue
      for (const selector of rule.selectors) {
        const className = targetClass(selector)
        if (className === null) continue
        const list = out.get(className) ?? []
        list.push(value)
        out.set(className, list)
      }
    }
  }
  return out
}

/** Every `color:` declaration in `ui.css`, keyed by the class that carries it. */
function paintedText(): Painted[] {
  const out: Painted[] = []
  for (const rule of parseRules(UI_CSS)) {
    for (const [property, value] of rule.declarations) {
      if (property !== 'color') continue
      for (const selector of rule.selectors) {
        const className = targetClass(selector)
        if (className === null) continue
        out.push({ selector, className, property: 'color', value })
      }
    }
  }
  return out
}

const BACKGROUNDS = backgroundsByClass()

/**
 * Every ground a class can be painted on, as flat colours.
 *
 * More than one is normal and each has to clear the floor on its own: a block may declare a base
 * surface and a `:hover` surface, and a gradient contributes both of its ends. An alpha surface is
 * composited over the ground BEHIND it, walking outward through the enclosing names and finishing
 * on `--cf-bg`, because that is what the reader sees through it.
 */
function groundsFor(className: string, tokens: ReadonlyMap<string, string>): Colour[] {
  const page = resolveColour('var(--cf-bg)', tokens)
  const names = enclosingNames(className)

  const flatten = (from: number): Colour => {
    for (let i = from; i < names.length; i += 1) {
      const declared = BACKGROUNDS.get(names[i] ?? '')?.[0]
      if (declared === undefined) continue
      const stops = gradientStops(declared, tokens)
      const colour = stops.length > 0 ? (stops[0] as Colour) : resolveColour(declared, tokens)
      return over(colour, flatten(i + 1))
    }
    return page
  }

  const out: Colour[] = []
  for (let i = 0; i < names.length; i += 1) {
    for (const declared of BACKGROUNDS.get(names[i] ?? '') ?? []) {
      const stops = gradientStops(declared, tokens)
      const layers = stops.length > 0 ? stops : [resolveColour(declared, tokens)]
      for (const layer of layers) out.push(over(layer, flatten(i + 1)))
    }
    // Only the nearest name that declares anything is a ground; the rest are behind it, and are
    // reached through `flatten` above. Otherwise a tooltip label would also be measured against
    // the chart panel it is floating over, which is not a pair the browser ever paints.
    if (out.length > 0) break
  }
  return out.length > 0 ? out : [page]
}

/**
 * Every custom property a declared value REACHES through its `var()` chain.
 *
 * Names, not colours, and that distinction is the whole point of the accent-as-text check below:
 * whether a rule is allowed to paint text is a question about which TOKEN it names, and it has to
 * stay a question about the token even when the colour behind that token happens to measure fine.
 *
 * `stopAt` is walked to but not through. `--cf-accent-text` resolves to `var(--cf-accent)` for the
 * three products whose accent already clears the text floor, so without a terminal the sanctioned
 * token would report itself as the forbidden one.
 */
function tokensReached(
  value: string,
  tokens: ReadonlyMap<string, string>,
  stopAt: ReadonlySet<string> = new Set(),
  depth = 0,
): Set<string> {
  const out = new Set<string>()
  if (depth > 12) return out
  for (const m of value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    const name = m[1] ?? ''
    out.add(name)
    if (stopAt.has(name)) continue
    const declared = tokens.get(name)
    if (declared === undefined) continue
    for (const inner of tokensReached(declared, tokens, stopAt, depth + 1)) out.add(inner)
  }
  return out
}

/* ═══════════════════════════════════ the scopes under test ═══════════════════════════════════ */

const SUBSTRATES = ['warm', 'cool'] as const

/** Every `data-cf-product` value `tokens.css` declares a block for, plus the default. */
const PRODUCTS: ReadonlyArray<string | null> = [
  null,
  ...new Set([...TOKENS_CSS.matchAll(/\[data-cf-product='([a-z-]+)'\]/g)].map((m) => m[1] ?? '')),
]

const TEXT_AA = 4.5
const NON_TEXT_AA = 3

/**
 * The rules held to the 3:1 graphical floor rather than the 4.5:1 text floor.
 *
 * ── Why there is a list at all, and why it is not a way of switching the check off ─────────────
 *
 * WCAG 2.2 exempts "pure decoration" from 1.4.3 and puts it under 1.4.11 instead, at 3:1. That is
 * a real distinction and refusing to model it would be dishonest in the other direction — but it
 * is also the obvious lever for making a red suite green, so it is bounded three ways:
 *
 *   1. An entry names ONE class, with the reason and the element that actually carries the
 *      meaning instead. It is still held to 3:1 — an exemption from "text" is not an exemption.
 *   2. Every entry is asserted to be STILL BELOW 4.5:1. The day the token behind it is retuned,
 *      this file goes red and says to delete the entry. That is the same two-directional shape as
 *      `assertKnownStillBroken` in the frontends' axe sweeps, and for the same reason: an
 *      exemption that can only ever pass is indistinguishable from a deleted test.
 *   3. `aria-hidden` alone does not qualify and must not, which is worth stating because it is the
 *      tempting shortcut. `.cf-menu__label`, `.cf-chart__axis` and `.cf-account__avatar` are all
 *      `aria-hidden="true"` and all carry visible words a sighted low-vision reader reads; 1.4.3
 *      is a VISUAL criterion and owes them 4.5:1 whatever the accessibility tree says. Exempting
 *      by `aria-hidden` would have quietly excused four of the seven rules this defect was
 *      reported on.
 */
const DECORATION: ReadonlyArray<{ readonly className: string; readonly why: string }> = [
  {
    className: 'cf-chart__fail-icon',
    why:
      'a filled square glyph (charts.tsx renders the literal ■), aria-hidden, drawn beside ' +
      '.cf-chart__fail-text which carries the actual word in --cf-fg-dim at 8.5:1. It conveys ' +
      'nothing on its own, which is what "pure decoration" means in 1.4.3. Lifting --cf-viz-crit ' +
      'to #dc593d would clear 4.5:1 here and cost 2.4 dE of deuteranopic separation from ' +
      '--cf-viz-warn (14.3 -> 11.9, measured with scripts/validate_palette.mjs) — a worse trade ' +
      'on the one surface tokens.css says a colourblind reader reads under stress.',
  },
]

const DECORATED = new Set(DECORATION.map((d) => d.className))

/* ══════════════════════════════════════════ the maths ════════════════════════════════════════ */

describe('the contrast maths', () => {
  it('agrees with the two ratios everybody knows', () => {
    // Without this the whole file could be computing something plausible and wrong, and every
    // assertion below would pass for the wrong reason.
    assert.equal(contrast(parseHex('#ffffff'), parseHex('#000000')).toFixed(2), '21.00')
    assert.equal(contrast(parseHex('#777777'), parseHex('#ffffff')).toFixed(2), '4.48')
  })

  it('is order-independent', () => {
    assert.equal(contrast(parseHex('#123456'), parseHex('#fedcba')), contrast(parseHex('#fedcba'), parseHex('#123456')))
  })

  it('mixes in sRGB, which is what the stylesheet asks for', () => {
    assert.equal(toHex(mixSrgb(parseHex('#ffffff'), 50, parseHex('#000000'))), '#808080')
    assert.equal(toHex(mixSrgb(parseHex('#e8622c'), 100, TRANSPARENT)), '#e8622c')
  })

  it('composites an alpha surface over what is behind it', () => {
    // `--cf-surface-hover` is bone at 6%, and what a reader sees is that over the panel. A test
    // that measured the 6% colour itself would be measuring something nobody ever sees.
    assert.equal(toHex(over({ r: 255, g: 255, b: 255, a: 0.5 }, parseHex('#000000'))), '#808080')
    assert.equal(toHex(over(parseHex('#123456'), parseHex('#ffffff'))), '#123456')
  })
})

/* ═════════════════════════════════════════ the parser ════════════════════════════════════════ */

describe('the stylesheets were actually read', () => {
  it('found the rules in both files', () => {
    // A regex that matched nothing would turn every loop below into a loop over nothing, and this
    // file would read as a guarantee while measuring none. This is the failure mode that let a
    // registry parser in this estate read exactly one entry and report the set was consistent.
    assert.ok(parseRules(TOKENS_CSS).length >= 15, `tokens.css parsed to ${parseRules(TOKENS_CSS).length} rules`)
    assert.ok(parseRules(UI_CSS).length >= 60, `ui.css parsed to ${parseRules(UI_CSS).length} rules`)
  })

  it('resolves the two substrates to DIFFERENT answers', () => {
    const warm = declaredTokens({ substrate: 'warm', product: null })
    const cool = declaredTokens({ substrate: 'cool', product: null })
    for (const token of ['--cf-bg', '--cf-bg-raised', '--cf-fg', '--cf-fg-dim', '--cf-fg-mute']) {
      assert.notEqual(
        toHex(resolveColour(`var(${token})`, warm)),
        toHex(resolveColour(`var(${token})`, cool)),
        `${token} resolves identically on both substrates, so one of them is not being applied`,
      )
    }
  })

  it('resolves the semantic layer through the ramp, not to a literal', () => {
    const warm = declaredTokens({ substrate: 'warm', product: null })
    assert.equal(toHex(resolveColour('var(--cf-bg-raised)', warm)), toHex(resolveColour('var(--cf-ash-850)', warm)))
    assert.equal(toHex(resolveColour('var(--cf-fg-mute)', warm)), toHex(resolveColour('var(--cf-khaki)', warm)))
  })

  it('resolves a color-mix and composites it, rather than reading the operand', () => {
    const warm = declaredTokens({ substrate: 'warm', product: null })
    const line = resolveColour('var(--cf-line)', warm)
    assert.ok(line.a > 0 && line.a < 1, `--cf-line resolved to alpha ${line.a}`)
    assert.notEqual(toHex(over(line, resolveColour('var(--cf-bg)', warm))), toHex(resolveColour('var(--cf-fg)', warm)))
  })

  it('finds the exact pairs this defect was found on', () => {
    /*
     * The named half of the guard. Everything else here is derived, which is what makes it survive
     * a change to `ui.css` — but a derivation that quietly resolves to nothing is indistinguishable
     * from a passing test, so the three grounds the axe runs actually reported are pinned by name.
     */
    const tokens = declaredTokens({ substrate: 'cool', product: null })
    const panel = toHex(resolveColour('var(--cf-bg-raised)', tokens))

    const tile = paintedText().find((p) => p.className === 'cf-tile__label')
    assert.ok(tile, 'ui.css no longer paints .cf-tile__label')
    assert.equal(tile.value, 'var(--cf-fg-mute)')
    assert.deepEqual(groundsFor('cf-tile__label', tokens).map(toHex), [panel])

    const menu = paintedText().find((p) => p.className === 'cf-menu__label')
    assert.ok(menu, 'ui.css no longer paints .cf-menu__label')
    assert.deepEqual(groundsFor('cf-menu__label', tokens).map(toHex), [panel])

    // And the one that proves the enclosing-name walk works: the tooltip label sits on the
    // tooltip's own surface, not on the chart panel behind it.
    assert.ok(paintedText().some((p) => p.className === 'cf-chart__tip-label'))
    assert.deepEqual(
      groundsFor('cf-chart__tip-label', tokens).map(toHex),
      [toHex(resolveColour('var(--cf-surface-solid)', tokens))],
    )
  })

  it('measures a useful number of pairs, on every scope', () => {
    let pairs = 0
    for (const substrate of SUBSTRATES) {
      const tokens = declaredTokens({ substrate, product: null })
      for (const painted of paintedText()) pairs += groundsFor(painted.className, tokens).length
    }
    assert.ok(pairs >= 100, `only ${pairs} text pairs were measured`)
  })
})

/* ═══════════════════════════════════ the bar this file sets ══════════════════════════════════ */

describe('every text pair this package ships clears WCAG AA', () => {
  for (const substrate of SUBSTRATES) {
    it(`on the ${substrate} substrate, for every product accent`, () => {
      const failures: string[] = []
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        for (const painted of paintedText()) {
          const floor = DECORATED.has(painted.className) ? NON_TEXT_AA : TEXT_AA
          const ink = resolveColour(painted.value, tokens)
          for (const ground of groundsFor(painted.className, tokens)) {
            const ratio = contrast(over(ink, ground), ground)
            if (ratio >= floor) continue
            failures.push(
              `  ${painted.selector} { color: ${painted.value} } = ${toHex(ink)} on ${toHex(ground)} ` +
                `= ${ratio.toFixed(2)}:1, below ${floor}:1 ` +
                `[substrate=${substrate}, product=${product ?? 'default'}]`,
            )
          }
        }
      }
      assert.equal(
        failures.length,
        0,
        `text below the AA floor for normal text:\n${[...new Set(failures)].join('\n')}`,
      )
    })
  }

  it('still needs every decoration exemption it claims', () => {
    /*
     * The inverted half, and the reason the list above is not a way of switching the check off. An
     * entry that has stopped failing at 4.5:1 is an entry whose token has been retuned, and it has
     * to be deleted rather than left sitting there quietly excusing the next regression on the
     * same class. Same shape as `assertKnownStillBroken` in the frontends' axe sweeps.
     */
    const painted = paintedText()
    for (const entry of DECORATION) {
      const rules = painted.filter((p) => p.className === entry.className)
      assert.ok(rules.length > 0, `ui.css no longer paints .${entry.className} — delete the exemption`)

      let worst = Number.POSITIVE_INFINITY
      for (const substrate of SUBSTRATES) {
        const tokens = declaredTokens({ substrate, product: null })
        for (const rule of rules) {
          const ink = resolveColour(rule.value, tokens)
          for (const ground of groundsFor(rule.className, tokens)) worst = Math.min(worst, contrast(ink, ground))
        }
      }
      assert.ok(
        worst < TEXT_AA,
        `.${entry.className} now measures ${worst.toFixed(2)}:1 everywhere — it clears the text ` +
          'floor unaided, so it is no longer decoration held to 3:1 and the entry in DECORATION ' +
          'must be deleted',
      )
    }
  })

  it('holds the muted token — the one that was broken — well clear on every surface it lands on', () => {
    /*
     * Named explicitly as well as swept, because this is the token the estate recorded as a known
     * violation in three repositories, and a sweep that silently stopped covering it would let the
     * same defect back in under a passing suite.
     */
    for (const substrate of SUBSTRATES) {
      const tokens = declaredTokens({ substrate, product: null })
      const mute = resolveColour('var(--cf-fg-mute)', tokens)
      for (const surface of ['--cf-bg', '--cf-bg-raised', '--cf-bg-sunken', '--cf-surface-solid']) {
        const ground = over(resolveColour(`var(${surface})`, tokens), resolveColour('var(--cf-bg)', tokens))
        const ratio = contrast(mute, ground)
        assert.ok(
          ratio >= TEXT_AA,
          `--cf-fg-mute ${toHex(mute)} on ${surface} ${toHex(ground)} (${substrate}) is ${ratio.toFixed(2)}:1`,
        )
      }
      // And on the lightest thing the system can compose beneath it: the hover wash on a panel.
      const wash = over(
        resolveColour('var(--cf-surface-hover)', tokens),
        resolveColour('var(--cf-bg-raised)', tokens),
      )
      assert.ok(
        contrast(mute, wash) >= TEXT_AA,
        `--cf-fg-mute on a hovered panel row (${toHex(wash)}, ${substrate}) is ` +
          `${contrast(mute, wash).toFixed(2)}:1`,
      )
    }
  })

  it('keeps the three text steps apart, which is what the muted token is FOR', () => {
    /*
     * The counterweight to the assertion above, and the reason the fix was a renormalisation of the
     * cool ramp rather than "lighten the muted token until it passes". A muted token raised until
     * it clears AA and no further is a muted token that has stopped being muted: the hierarchy the
     * design system uses to separate a label from its value collapses, and every caption starts
     * competing with the text it annotates.
     *
     * 10 L* is roughly the point at which two greys read as two deliberate steps rather than as one
     * colour drawn twice. Both substrates now sit around 15.5, which is the warm ramp's own figure.
     */
    for (const substrate of SUBSTRATES) {
      const tokens = declaredTokens({ substrate, product: null })
      const steps = (['--cf-fg', '--cf-fg-dim', '--cf-fg-mute'] as const).map((t) =>
        lightness(resolveColour(`var(${t})`, tokens)),
      )
      for (let i = 1; i < steps.length; i += 1) {
        const gap = (steps[i - 1] as number) - (steps[i] as number)
        assert.ok(gap >= 10, `${substrate}: text step ${i} is only ${gap.toFixed(1)} L* below step ${i - 1}`)
      }
    }
  })
})

/* ═══════════════════════════════════════ the chart palette ═══════════════════════════════════ */

describe('the chart palette clears the non-text floor on every substrate', () => {
  /*
   * chart-palette.md records "[PASS] Contrast vs surface all 8 >= 3:1" — measured against the WARM
   * panel `#141110` and stated as if it were universal. The cool panel `#151d21` is lighter, so
   * every one of these measures lower there, and nothing had ever checked it. They all still pass;
   * this is what says so.
   */
  const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--cf-viz-${n}`)
  const ROLES = ['--cf-viz-good', '--cf-viz-warn', '--cf-viz-crit', '--cf-viz-gain', '--cf-viz-loss']

  for (const substrate of SUBSTRATES) {
    it(`on the ${substrate} substrate`, () => {
      const tokens = declaredTokens({ substrate, product: null })
      const surface = resolveColour('var(--cf-viz-surface)', tokens)
      for (const token of [...SERIES, ...ROLES]) {
        const ratio = contrast(resolveColour(`var(${token})`, tokens), surface)
        assert.ok(ratio >= NON_TEXT_AA, `${token} on --cf-viz-surface (${substrate}) is ${ratio.toFixed(2)}:1`)
      }
    })
  }

  it('keeps the sequential ramp readable as steps, and does not pretend its dark end is a control', () => {
    /*
     * Inverted on purpose, and the inversion is the point.
     *
     * `--cf-viz-seq-100` encodes "near zero" and is DELIBERATELY below the 3:1 non-text floor —
     * it measures 2.02:1 on the warm panel and 1.83:1 on the cool one. Holding it to 3:1 would
     * mean lifting the dark end into the middle of the ramp and compressing the step that
     * separates "nothing" from "a little", which is the encoding.
     *
     * So what is asserted is what actually has to be true: the ramp is monotonic, every adjacent
     * pair is a visible step, and the dark end is still darker than the floor — if it ever clears
     * 3:1 the ramp has been retuned and this comment, and chart-palette.md, are out of date.
     */
    const steps = [100, 200, 300, 400, 500, 600, 700].map((n) => `--cf-viz-seq-${n}`)
    for (const substrate of SUBSTRATES) {
      const tokens = declaredTokens({ substrate, product: null })
      const surface = resolveColour('var(--cf-viz-surface)', tokens)
      const ls = steps.map((t) => lightness(resolveColour(`var(${t})`, tokens)))
      for (let i = 1; i < ls.length; i += 1) {
        const gap = (ls[i] as number) - (ls[i - 1] as number)
        assert.ok(gap >= 4, `${steps[i]} is only ${gap.toFixed(1)} L* above ${steps[i - 1]}`)
      }
      const dark = contrast(resolveColour(`var(${steps[0]})`, tokens), surface)
      assert.ok(
        dark < NON_TEXT_AA,
        `${steps[0]} now measures ${dark.toFixed(2)}:1 on the ${substrate} panel — the ramp has ` +
          'been retuned, and the "near zero is visible, not invisible" note in tokens.css and the ' +
          'light-end figure in chart-palette.md both need re-deriving',
      )
      const light = contrast(resolveColour(`var(${steps.at(-1)})`, tokens), surface)
      assert.ok(light >= NON_TEXT_AA, `${steps.at(-1)} on the ${substrate} panel is ${light.toFixed(2)}:1`)
    }
  })
})

/* ══════════════════════════════════ ink on a filled control ══════════════════════════════════ */

describe('the label on a filled control is legible against its fill', () => {
  it('ember ink on ember, in both of its states', () => {
    const tokens = declaredTokens({ substrate: 'warm', product: null })
    const ink = resolveColour('var(--cf-ember-ink)', tokens)
    for (const fill of ['--cf-ember', '--cf-ember-hover']) {
      const ratio = contrast(ink, resolveColour(`var(${fill})`, tokens))
      assert.ok(ratio >= TEXT_AA, `--cf-ember-ink on ${fill} is ${ratio.toFixed(2)}:1`)
    }
  })

  it('each product accent ink on its own accent, in both of its states', () => {
    for (const substrate of SUBSTRATES) {
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        const ink = resolveColour('var(--cf-accent-ink)', tokens)
        for (const fill of ['--cf-accent', '--cf-accent-hover']) {
          const ratio = contrast(ink, resolveColour(`var(${fill})`, tokens))
          assert.ok(
            ratio >= TEXT_AA,
            `--cf-accent-ink on ${fill} for product=${product ?? 'default'} (${substrate}) is ` +
              `${ratio.toFixed(2)}:1`,
          )
        }
      }
    }
  })

  it('never lets the avatar fill go darker than the accent its ink is defined against', () => {
    /*
     * The rule that makes the assertion above sufficient rather than merely true.
     *
     * `--cf-accent-ink` is specified against `--cf-accent`. `.cf-account__avatar` is the one place
     * in this package that sets type in it, and it used to draw a gradient that darkened the
     * accent by 45% across the disc — so the ink was measured on a ground it was never chosen for
     * and landed between 2.17:1 and 3.87:1 depending on the product. Asserting the ink alone would
     * not have caught that; asserting the fill's DARKEST point is what makes the pair closed.
     *
     * Read out of `ui.css`, so re-darkening the gradient fails here rather than in a browser.
     */
    for (const substrate of SUBSTRATES) {
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        const accent = luminance(resolveColour('var(--cf-accent)', tokens))
        const declared = BACKGROUNDS.get('cf-account__avatar')?.[0]
        assert.ok(declared, '.cf-account__avatar no longer declares a background')
        const stops = gradientStops(declared, tokens)
        assert.ok(stops.length >= 2, `.cf-account__avatar is no longer a gradient: ${declared}`)
        for (const stop of stops) {
          assert.ok(
            luminance(stop) >= accent - 1e-9,
            `.cf-account__avatar has a stop at ${toHex(stop)}, darker than --cf-accent, for ` +
              `product=${product ?? 'default'} (${substrate}) — --cf-accent-ink is not valid there`,
          )
        }
      }
    }
  })
})

/* ═══════════════════════════ an accent USED AS TEXT, held to the text floor ═══════════════════ */

/**
 * THE DEFECT: A COLOUR VALIDATED FOR ONE JOB AND USED FOR ANOTHER.
 *
 * `design-system.md` §Contrast says "large text and UI marks >= 3:1. Every accent above clears 3:1
 * on --cf-bg-raised, verified." That is the right floor for what `--cf-accent` does in THIS
 * package — border, outline, box-shadow, fill — and `ui.css` sets it as `color:` nowhere.
 *
 * Consumers set it as `color:` on 0.9rem body copy, where the floor is 4.5:1. So a product accent
 * could pass every check this system ran and still fail on the surface, and one did:
 * `micro-foresight-admin-web` painted `.wt-link` in foresight's `#1e89c7`, 4.44:1 on the cool
 * panel, from the day it shipped.
 *
 * `--cf-accent-text` is the colour for that job, derived per product (see tokens.css). What is
 * asserted here is not just that it clears the floor — it is that the FLOOR AND THE USAGE CANNOT
 * DISAGREE AGAIN, which takes four assertions pulling in different directions:
 *
 *   1. `--cf-accent-text` clears 4.5:1 on every ground this package composes text on. The
 *      validation the accent never got.
 *   2. `--cf-accent` still clears its OWN 3:1 floor there. It keeps its job; this is not a
 *      deprecation, and retuning the text step must not be allowed to break the mark step.
 *   3. A `color:` rule may not NAME `--cf-accent` or `--cf-accent-hover`. By token name, never by
 *      measured ratio — a ratio check passes for whichever products happen to clear, and that
 *      per-product pass is precisely what hid foresight behind trade.
 *   4. The eight accents that FAIL the text floor are recorded and asserted to still fail. Same
 *      shape as `assertKnownStillBroken`: the day the palette is retuned so every accent clears,
 *      this goes red and says `--cf-accent-text` has become a fork worth deleting.
 */
describe('an accent used as text', () => {
  /** The classes WCAG 1.4.3 exempts as logotype. Bounded by the test below, not by this comment. */
  const LOGOTYPE = ['cf-logo__mark', 'cf-logo__word']

  /**
   * Every ground this package composes BODY COPY on, derived from the sheet rather than listed.
   *
   * "Body copy" is the qualifier that makes the set the right one, and it is read out of the
   * stylesheet rather than assumed: a ground counts if some rule paints text on it in one of the
   * three foreground tokens. That excludes the accent and ember FILLS — `.cf-btn--primary`,
   * `.cf-account__avatar` — which are grounds for `--cf-accent-ink`, a pair already closed by
   * "the label on a filled control is legible against its fill" above. Sweeping them here would
   * measure accent-on-accent at 1.1:1 and report the token unfixable rather than unfixed.
   *
   * `--cf-accent-text` is a substitute for body copy, so the grounds body copy lands on are
   * exactly the grounds it has to survive.
   */
  const FOREGROUND = new Set(['--cf-fg', '--cf-fg-dim', '--cf-fg-mute'])

  function textGrounds(tokens: ReadonlyMap<string, string>): Map<string, Colour> {
    const out = new Map<string, Colour>()
    for (const painted of paintedText()) {
      const reached = tokensReached(painted.value, tokens)
      if (![...reached].some((t) => FOREGROUND.has(t))) continue
      for (const ground of groundsFor(painted.className, tokens)) out.set(toHex(ground), ground)
    }
    return out
  }

  it('composites an alpha ground to what the browser paints, not to the surface beneath it', () => {
    /*
     * The premise every number below rests on, pinned by hex.
     *
     * `--cf-surface-hover` is `color-mix(in srgb, var(--cf-fg) 6%, transparent)`. CSS Color 5
     * interpolates color-mix in PREMULTIPLIED space and converts back, so that is bone at full
     * strength with alpha 0.06 — and a hovered panel row is therefore #211e1c warm / #21292d cool,
     * not the panel. `mixSrgb` used to interpolate straight, which multiplied the channels by the
     * alpha here and again in `over`, and resolved every alpha ground in the package to very
     * nearly the opaque surface behind it: 5.19:1 for `--cf-fg-mute` on a hovered warm row against
     * the 4.58:1 the browser actually paints. tokens.css derived the cool ramp against "4.569:1",
     * so the derivation and the test that was meant to hold it had already drifted apart, with the
     * test reporting the laxer number.
     */
    const warm = declaredTokens({ substrate: 'warm', product: null })
    const cool = declaredTokens({ substrate: 'cool', product: null })
    const row = (t: ReadonlyMap<string, string>): string =>
      toHex(over(resolveColour('var(--cf-surface-hover)', t), resolveColour('var(--cf-bg-raised)', t)))
    assert.equal(row(warm), '#211e1c')
    assert.equal(row(cool), '#21292d')
    // And the lightest thing this package sets text on: the current menu item, --cf-fg at 8%.
    const current = (t: ReadonlyMap<string, string>): string =>
      toHex(
        over(
          resolveColour('color-mix(in srgb, var(--cf-fg) 8%, transparent)', t),
          resolveColour('var(--cf-surface-solid)', t),
        ),
      )
    assert.equal(current(warm), '#252220')
    assert.equal(current(cool), '#252d31')
  })

  it('sweeps a useful number of grounds, so a pass here cannot be a pass over nothing', () => {
    for (const substrate of SUBSTRATES) {
      const grounds = textGrounds(declaredTokens({ substrate, product: null }))
      assert.ok(grounds.size >= 4, `only ${grounds.size} distinct text grounds on ${substrate}`)
      // The tightest one has to be in the set, or the sweep is measuring the easy surfaces.
      assert.ok(
        grounds.has(substrate === 'warm' ? '#252220' : '#252d31'),
        `the current-menu-item ground is not in the ${substrate} sweep: ${[...grounds.keys()].join(' ')}`,
      )
    }
  })

  it('clears the 4.5:1 TEXT floor for every product, on every ground, on both substrates', () => {
    const failures: string[] = []
    for (const substrate of SUBSTRATES) {
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        const ink = resolveColour('var(--cf-accent-text)', tokens)
        for (const ground of textGrounds(tokens).values()) {
          const ratio = contrast(over(ink, ground), ground)
          if (ratio >= TEXT_AA) continue
          failures.push(
            `  --cf-accent-text ${toHex(ink)} on ${toHex(ground)} = ${ratio.toFixed(2)}:1 ` +
              `[substrate=${substrate}, product=${product ?? 'default'}]`,
          )
        }
      }
    }
    assert.equal(failures.length, 0, `accent text below the AA floor:\n${failures.join('\n')}`)
  })

  it('leaves --cf-accent clearing the 3:1 NON-TEXT floor it is validated at', () => {
    // The job the accent keeps. Splitting the token is not a deprecation, and a retune of the text
    // step must not be allowed to quietly break the border, outline and rule the accent still is.
    const failures: string[] = []
    for (const substrate of SUBSTRATES) {
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        for (const name of ['--cf-accent', '--cf-accent-hover']) {
          const mark = resolveColour(`var(${name})`, tokens)
          for (const ground of textGrounds(tokens).values()) {
            const ratio = contrast(over(mark, ground), ground)
            if (ratio >= NON_TEXT_AA) continue
            failures.push(
              `  ${name} ${toHex(mark)} on ${toHex(ground)} = ${ratio.toFixed(2)}:1 ` +
                `[substrate=${substrate}, product=${product ?? 'default'}]`,
            )
          }
        }
      }
    }
    assert.equal(failures.length, 0, `an accent below its own non-text floor:\n${failures.join('\n')}`)
  })

  it('never lets a `color:` rule NAME the accent instead of the accent text token', () => {
    /*
     * THE ASSERTION THAT MAKES VALIDATION AND USAGE AGREE, and the one that had to be about names.
     *
     * The ratio sweep at the top of this file already measures every `color:` in `ui.css` at
     * 4.5:1 — and it would have passed a rule painted in `--cf-accent` for eight of the eleven
     * products while failing it for the other three, which is EXACTLY what happened in the estate:
     * trade at 5.21:1 and worlds at 5.18:1 looked like evidence the rule was fine, and foresight
     * at 4.44:1 was written off as one surface's problem. A check whose answer depends on which
     * product is mounted cannot enforce a rule about which token to use.
     *
     * So the rule is enforced by name: 3:1 tokens are not text. It holds for every product at
     * once, it holds for a product added tomorrow, and it holds for the accent of a product whose
     * hue happens to be light enough to get away with it today.
     */
    const tokens = declaredTokens({ substrate: 'cool', product: null })
    const sanctioned = new Set(['--cf-accent-text', '--cf-ember-text'])
    const forbidden = new Set(['--cf-accent', '--cf-accent-hover', '--cf-ember', '--cf-ember-hover'])
    const offenders = paintedText()
      .filter((p) => !LOGOTYPE.includes(p.className))
      .filter((p) => [...tokensReached(p.value, tokens, sanctioned)].some((t) => forbidden.has(t)))
      .map((p) => `  ${p.selector} { color: ${p.value} }`)
    assert.deepEqual(
      offenders,
      [],
      'a rule paints text in a token validated at 3:1. Use --cf-accent-text, which is the same ' +
        `hue derived to clear 4.5:1 on the tightest ground in the system:\n${offenders.join('\n')}`,
    )
  })

  it('exempts the logotype by name, and only where WCAG actually exempts it', () => {
    /*
     * The one exemption from the rule above, and the three things that stop it being a hole.
     *
     * WCAG 2.2 SC 1.4.3 exempts logotypes in terms: "Text that is part of a logo or brand name has
     * no contrast requirement." `.cf-logo__mark` is an SVG glyph reading `currentColor` and
     * `.cf-logo__word b` is the "Forge" half of the wordmark. They are the two places ui.css names
     * ember as `color:`, and the header of that file already records ember's three sanctioned uses.
     *
     *   1. Each entry must still resolve to EMBER, the company's chrome. A product accent is never
     *      a logotype, and it is product accents on body copy that this whole section is about.
     *   2. Each entry must still be a rule that exists. A logotype that stops being painted takes
     *      its exemption with it.
     *   3. THE EXEMPTION IS FROM THE NAME RULE, NOT FROM THE RATIO. Both are asserted at 4.5:1 on
     *      their own grounds regardless — the sweep at the top of this file measures them, and so
     *      does the assertion below. So the list cannot be used to excuse a contrast failure; it
     *      only says which token a logotype is allowed to be spelled in.
     */
    const base = declaredTokens({ substrate: 'cool', product: null })
    const accentish = new Set(['--cf-accent', '--cf-accent-hover', '--cf-ember', '--cf-ember-hover'])
    const painted = paintedText()
    for (const className of LOGOTYPE) {
      // `.cf-logo__word` also carries a plain --cf-fg rule; only the accent-spelled ones are what
      // the exemption is for, and there has to be at least one or the entry is dead weight.
      const rules = painted.filter(
        (p) => p.className === className && [...tokensReached(p.value, base)].some((t) => accentish.has(t)),
      )
      assert.ok(
        rules.length > 0,
        `.${className} no longer paints text in an accent token — delete the LOGOTYPE exemption`,
      )
      for (const substrate of SUBSTRATES) {
        for (const product of PRODUCTS) {
          const scope = declaredTokens({ substrate, product })
          for (const rule of rules) {
            assert.ok(
              tokensReached(rule.value, scope).has('--cf-ember'),
              `.${className} is spelled ${rule.value}, which is not the company ember — a product ` +
                'accent is not a logotype and does not get this exemption',
            )
            const ink = resolveColour(rule.value, scope)
            for (const ground of groundsFor(rule.className, scope)) {
              const ratio = contrast(over(ink, ground), ground)
              assert.ok(
                ratio >= TEXT_AA,
                `.${className} ${toHex(ink)} on ${toHex(ground)} is ${ratio.toFixed(2)}:1 ` +
                  `[${substrate}, ${product ?? 'default'}] — the logotype exemption is from the ` +
                  'token-name rule, never from the ratio',
              )
            }
          }
        }
      }
    }
  })

  it('is a lift of the accent, not a second brand colour', () => {
    /*
     * The counterweight to "just make it lighter until it passes", and the reason this does not
     * re-open the CVD derivation in tokens.css. Each text step is its own accent scaled in linear
     * light, so it is the SAME chromaticity one step up — never darker, and never a new hue that
     * would have to be validated against the other five products as a set.
     */
    const hueOf = (c: Colour): number => {
      const [mx, mn] = [Math.max(c.r, c.g, c.b), Math.min(c.r, c.g, c.b)]
      if (mx === mn) return 0
      const h =
        mx === c.r ? ((c.g - c.b) / (mx - mn)) % 6 : mx === c.g ? (c.b - c.r) / (mx - mn) + 2 : (c.r - c.g) / (mx - mn) + 4
      return (h * 60 + 360) % 360
    }
    for (const substrate of SUBSTRATES) {
      for (const product of PRODUCTS) {
        const tokens = declaredTokens({ substrate, product })
        const accent = resolveColour('var(--cf-accent)', tokens)
        const text = resolveColour('var(--cf-accent-text)', tokens)
        const where = `product=${product ?? 'default'} (${substrate})`
        assert.ok(
          luminance(text) >= luminance(accent) - 1e-9,
          `--cf-accent-text ${toHex(text)} is DARKER than --cf-accent ${toHex(accent)} for ${where}`,
        )
        const gap = Math.min(
          Math.abs(hueOf(text) - hueOf(accent)) % 360,
          360 - (Math.abs(hueOf(text) - hueOf(accent)) % 360),
        )
        assert.ok(
          gap <= 3,
          `--cf-accent-text ${toHex(text)} is ${gap.toFixed(1)} degrees off --cf-accent ` +
            `${toHex(accent)} for ${where} — it is a different colour, not a lighter step of the ` +
            'same one, and the switcher palette has to be re-validated as a set',
        )
      }
    }
  })

  it('still needs to exist — every accent recorded as failing the text floor still fails', () => {
    /*
     * The inverted half, and the reason `--cf-accent-text` is not a fork that can only ever pass.
     *
     * Eight of the eleven accents cannot be text on the tightest ground; three can, and those
     * three declare `--cf-accent-text: var(--cf-accent)` rather than a new hex. If the palette is
     * ever retuned so that all eleven clear, this token has stopped being a fix and started being
     * a second colour nobody needs — and this assertion says so instead of leaving it in place.
     */
    const CANNOT_BE_TEXT = ['foresight', 'network', 'trade', 'market', 'worlds', 'admin', 'developers']
    const CAN_BE_TEXT = ['create', 'lantern', 'beacon']
    for (const p of [...CANNOT_BE_TEXT, ...CAN_BE_TEXT]) {
      assert.ok(PRODUCTS.includes(p), `tokens.css no longer declares a block for ${p}`)
    }

    const worstFor = (product: string | null, token: string): number => {
      let worst = Number.POSITIVE_INFINITY
      for (const substrate of SUBSTRATES) {
        const tokens = declaredTokens({ substrate, product })
        const ink = resolveColour(`var(${token})`, tokens)
        for (const ground of textGrounds(tokens).values()) worst = Math.min(worst, contrast(ink, ground))
      }
      return worst
    }

    // The default (ember) fails too, which is why --cf-ember-text exists beside --cf-ember.
    for (const product of [null, ...CANNOT_BE_TEXT]) {
      const worst = worstFor(product, '--cf-accent')
      assert.ok(
        worst < TEXT_AA,
        `--cf-accent for product=${product ?? 'default'} now measures ${worst.toFixed(2)}:1 on every ` +
          'ground in the package — it can be text unaided, so its --cf-accent-text entry is a fork ' +
          'and should become var(--cf-accent) or be deleted with the rest',
      )
    }
    for (const product of CAN_BE_TEXT) {
      const worst = worstFor(product, '--cf-accent')
      assert.ok(
        worst >= TEXT_AA,
        `${product} declares --cf-accent-text: var(--cf-accent) but its accent measures ` +
          `${worst.toFixed(2)}:1 — it needs a derived text step like the other eight`,
      )
    }
  })
})

/* ═════════════════════════════════════════ the dark scope ════════════════════════════════════ */

describe('the .cf-dark scope', () => {
  it('re-asserts the same semantic layer it would have inherited, on both substrates', () => {
    /*
     * `.cf-dark` exists so CloudsForge chrome survives inside a light host, and it works by
     * restating the semantic tokens from the substrate. Restating them is exactly how they drift:
     * this compares every one against the value the same substrate produces without the scope, so
     * a token retuned in one place and not the other is a red test rather than a chrome that
     * disagrees with the page it sits on.
     */
    const semantic = [
      '--cf-bg',
      '--cf-bg-raised',
      '--cf-bg-sunken',
      '--cf-fg',
      '--cf-fg-dim',
      '--cf-fg-mute',
      '--cf-line',
      '--cf-line-strong',
      '--cf-surface',
      '--cf-surface-solid',
      '--cf-surface-hover',
    ]
    for (const substrate of SUBSTRATES) {
      const plain = declaredTokens({ substrate, product: null })
      const dark = declaredTokens({ substrate, product: null, dark: true })
      for (const token of semantic) {
        assert.equal(
          toHex(resolveColour(`var(${token})`, dark)),
          toHex(resolveColour(`var(${token})`, plain)),
          `${token} differs inside .cf-dark on the ${substrate} substrate`,
        )
      }
    }
  })
})
