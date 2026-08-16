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
      // The neighbour score is the gate, so rank on it — but a candidate that is a near-duplicate
      // of a NON-neighbour is still a bad citizen of a list a reader scans, so anything under
      // dE 10 to any existing accent is dropped before ranking rather than ranked and ignored.
      const all = separation(c, AVOID)
      if (all < 10) continue
      scored.push({ hex: c, h, s, l, adjacent: separation(c, NEIGHBOURS), all })
    }
  }
}
scored.sort((a, b) => b.adjacent - a.adjacent)

const top = Number(opt('top', 12))
console.log(
  `swept ${(360 / HUE_STEP) * SATS.length * LIGHTS.length} candidates at ${HUE_STEP}° steps; ` +
    `${scored.length} cleared dE 10 against all ${AVOID.length} existing/retired colours\n`,
)
console.log('  hex       hue  sat  light   dE to neighbours (the gate)   dE to any (recorded)')
for (const c of scored.slice(0, top)) {
  console.log(
    `  ${c.hex}  ${String(c.h).padStart(3)}° ${String(c.s).padStart(3)}% ${String(c.l).padStart(3)}%` +
      `             ${c.adjacent.toFixed(1).padStart(5)}                   ${c.all.toFixed(1)}`,
  )
}
