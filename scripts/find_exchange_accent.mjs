#!/usr/bin/env node
/**
 * Find the accent for a NEW switcher entry, by the method the palette was built with.
 *
 * Written for `exchange` joining `SWITCHER_SURFACES`, where the guard "gives every entry a
 * distinct accent" is what stops a row being added by hand. The registry's note above
 * PRODUCT_ACCENTS describes how the sixth accent was chosen — "hue swept in 2° steps across four
 * saturations and four values, filtered to the existing set's lightness and chroma band and to a
 * safe distance from every RETIRED_ACCENT, then scored on the metric that actually governs this
 * palette" — and that method is reproduced here rather than restated.
 *
 * THE METRIC IS NOT REIMPLEMENTED. Every score below comes from `validate_palette.mjs`, run as a
 * subprocess, because a second copy of CIEDE2000-over-Viénot in this repository is exactly the
 * drift that file was written to end. The trick that makes one subprocess enough per candidate:
 * interleaving the candidate between every existing accent — [c, e1, c, e2, c, e3, …] — makes
 * every ADJACENT pair a candidate-vs-existing pair, so the validator's own "worst ADJACENT" line
 * IS min dE(candidate, each existing) across normal, deuteranopia and protanopia.
 *
 * Usage:  node scripts/find_exchange_accent.mjs [--step 8] [--top 10]
 */

import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const VALIDATOR = fileURLToPath(new URL('./validate_palette.mjs', import.meta.url))
const args = process.argv.slice(2)
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`)
  return i === -1 ? d : args[i + 1]
}

/**
 * Everything the new accent must be distinguishable from.
 *
 * The nine switcher accents because the guard is over SWITCHER_SURFACES, and the five retired
 * ones because the registry says they "must never reappear anywhere" — a candidate that merely
 * differs from them by a digit while looking identical would satisfy the letter of that and none
 * of its point.
 */
const SWITCHER = [
  '#d6412f', // network
  '#1e89c7', // foresight
  '#6d9a49', // worlds
  '#9b7bf0', // market
  '#b28e1e', // create
  '#2a9e93', // trade
  '#c2704f', // admin
  '#f4a63c', // lantern
  '#7fae5c', // beacon
]
const RETIRED = ['#ff5a1e', '#ff8a1f', '#d9812f', '#ff7a2f', '#ff4d00']
const COMPANY = ['#e8622c'] // chrome, never a product accent — and never to be confused with one
const AVOID = [...SWITCHER, ...RETIRED, ...COMPANY]

/**
 * The two rows the new entry would actually touch, and THE GATE THAT MATTERS.
 *
 * Placed after `trade` (the last product, last by the owner's instruction) and before `admin` (the
 * first operator tool), so the neighbours are teal and terracotta. This is scored separately from
 * `AVOID` because the registry is explicit that they are different questions with different
 * answers: "the switcher is a vertical list, so only NEIGHBOURS ever touch, which makes adjacent
 * separation the honest gate; requiring all-pairs separation across eight brand-faithful hues is
 * unachievable and was verified so exhaustively."
 *
 * The all-pairs number is still printed, because the palette already documents its weakness
 * (red|gold at dE 5.6) rather than hiding it, and a new entry should be recorded the same way.
 */
const NEIGHBOURS = ['#2a9e93', '#c2704f']

/**
 * THE GATE THE FIRST SEARCH DID NOT KNOW ABOUT, added after it cost a red build.
 *
 * The first run of this script ranked on separation alone and returned `#dcde5e` — a yellow-green
 * that clears every distance gate comfortably and is the brightest colour in the palette by a
 * wide margin. micro-site then failed axe on `/products/exchange` with three serious
 * colour-contrast violations, because THE SITE SETS TYPE IN THE ACCENT, and it does so on a light
 * ground by darkening the accent a FIXED 68% toward black (`--si-accent` in micro-site's
 * styles.css). A fixed mix is a fixed *step*, not a fixed *result*: the six product accents all
 * land between 5.07:1 and 6.87:1 on the light page after it, and `#dcde5e` lands at 2.63:1.
 *
 * So separation is necessary and not sufficient. An accent must also survive being set as type,
 * and the cheapest way to guarantee that is to ask here rather than to discover it in CI. The
 * three light grounds and the 68% are read off the two files named below; if either moves, this
 * gate is wrong in the safe direction (it is the site that would then fail, loudly, again).
 *
 *   micro-ui/packages/ui/src/tokens.css   --cf-kiln-50 / -100 / -200, --cf-ash-*, --cf-bone
 *   micro-site/src/styles.css             --si-accent, both scheme blocks
 *
 * BOTH grounds are gated, and the second one is not redundant. The obvious reading — "a light
 * ground is the hard one, because the accent has to be darkened to reach it" — is what the first
 * version of this gate assumed, and it is only true for a BRIGHT accent. Run this with the light
 * gate alone and the survivors are all deep roses and reds, several of which then fail on the
 * DARK panel: `#ae3d72` reaches 8.14:1 on the light page and 3.91:1 on the dark raised surface.
 * A fixed mix is a fixed step in both directions, so each direction excludes an opposite end.
 */
const LIGHT_GROUNDS = ['#f3ece1', '#fbf7f0', '#e6dccd'] // kiln 100 / 50 / 200
const DARK_GROUNDS = ['#0e0c0a', '#171310', '#080706'] // ash 900 / 850 / 950
const BONE = '#ece5d6'
const SITE_LIGHT_MIX = 68 // darkened toward black
const SITE_DARK_MIX = 88 // lifted toward the bone foreground
const TEXT_AA = 4.5

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const luminance = (c) =>
  0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2])
const chan = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const blend = (a, pct, b) => a.map((v, i) => Math.round((v * pct + b[i] * (100 - pct)) / 100))

/** The worst ratio this accent reaches as TYPE on any ground the site paints, either scheme. */
function typeContrast(candidate) {
  const c = rgb(candidate)
  const onLight = blend(c, SITE_LIGHT_MIX, [0, 0, 0])
  const onDark = blend(c, SITE_DARK_MIX, rgb(BONE))
  return Math.min(
    ...LIGHT_GROUNDS.map((g) => contrast(onLight, rgb(g))),
    ...DARK_GROUNDS.map((g) => contrast(onDark, rgb(g))),
  )
}

const hex = (n) => Math.round(n * 255).toString(16).padStart(2, '0')
function hsl(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = (n) => {
    const k = (n + h / 30) % 12
    return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/** min dE(candidate, each colour in `against`), from the validator, in one subprocess. */
function separation(candidate, against) {
  const interleaved = against.flatMap((e) => [candidate, e]).concat(candidate)
  try {
    const out = execFileSync(process.execPath, [VALIDATOR, interleaved.join(',')], {
      encoding: 'utf8',
    })
    return Number(/worst ADJACENT : dE ([\d.]+)/.exec(out)?.[1] ?? 0)
  } catch (err) {
    // A candidate below the validator's own --min exits non-zero; the number is still on stdout,
    // and a low score is a result rather than an error.
    const out = String(err.stdout ?? '')
    return Number(/worst ADJACENT : dE ([\d.]+)/.exec(out)?.[1] ?? 0)
  }
}

/**
 * The existing set's lightness and chroma band, as the registry's note requires. Read off the six
 * product accents rather than chosen: they span roughly L 45-62 and S 45-75 in HSL terms, and a
 * candidate outside that band is a different KIND of colour, not a different hue.
 */
const HUE_STEP = Number(opt('step', 8))
const SATS = [48, 56, 64, 72]
const LIGHTS = [46, 52, 58, 64]

const scored = []
for (let h = 0; h < 360; h += HUE_STEP) {
  for (const s of SATS) {
    for (const l of LIGHTS) {
      const c = hsl(h, s, l)
      // Legibility first, and as a HARD filter rather than a ranking term: a candidate that
      // cannot carry type is not a worse accent, it is not an accent. Checked before the
      // validator because it is arithmetic and the validator is a subprocess.
      const type = typeContrast(c)
      if (type < TEXT_AA) continue
      // The neighbour score is the gate, so rank on it — but a candidate that is a near-duplicate
      // of a NON-neighbour is still a bad citizen of a list a reader scans, so anything under
      // dE 10 to any existing accent is dropped before ranking rather than ranked and ignored.
      const all = separation(c, AVOID)
      if (all < 10) continue
      scored.push({ hex: c, h, s, l, adjacent: separation(c, NEIGHBOURS), all, type })
    }
  }
}
scored.sort((a, b) => b.adjacent - a.adjacent)

const top = Number(opt('top', 12))
console.log(
  `swept ${(360 / HUE_STEP) * SATS.length * LIGHTS.length} candidates at ${HUE_STEP}° steps; ` +
    `${scored.length} cleared dE 10 against all ${AVOID.length} existing/retired colours\n`,
)
console.log('  hex       hue  sat  light   dE neighbours (gate)   dE any (recorded)   type, worst ground')
for (const c of scored.slice(0, top)) {
  console.log(
    `  ${c.hex}  ${String(c.h).padStart(3)}° ${String(c.s).padStart(3)}% ${String(c.l).padStart(3)}%` +
      `        ${c.adjacent.toFixed(1).padStart(5)}              ${c.all.toFixed(1).padStart(5)}` +
      `              ${c.type.toFixed(2)}:1`,
  )
}
