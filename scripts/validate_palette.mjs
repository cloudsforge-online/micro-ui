#!/usr/bin/env node
/**
 * Measure a candidate accent palette the way this design system claims to measure it.
 *
 * ## Why this file was written
 *
 * `packages/ui/src/tokens.css` carried a "Reproduce:" line pointing at
 * `scripts/validate_palette.js`, and **no such file has ever existed in this repository**. The
 * dE figures recorded beside it — worst-adjacent 17.0 under normal vision, 12.9 under
 * deuteranopia — therefore could not be re-derived by anyone, which is how they survived
 * unchallenged while an independent measurement of the same five colours produced 36.1 and 37.6.
 *
 * A number nobody can reproduce is not a measurement, it is a claim. This makes it a measurement.
 * The same defect class as `micro-contracts`' `pnpm compat`, which pointed at a `tools/compat.ts`
 * that has never existed, so the estate's contract-compatibility gate had never run anywhere.
 *
 * ## What it measures, and the one judgement call
 *
 * CIEDE2000 over a Viénot 1999 dichromat simulation, in three modes: normal, deuteranopia,
 * protanopia. Two different questions are answered separately, because they have different
 * answers and conflating them is what made the original claim confusing:
 *
 *   - **ADJACENT** — the honest gate for a vertical switcher, where only neighbours ever touch.
 *   - **ALL-PAIRS** — the gate for anything that renders two accents together out of order: a
 *     legend, a chart, a comparison table.
 *
 * The palette passes the first comfortably and fails the second, and always has. That is a
 * deliberate, documented trade (see tokens.css), not a defect — but it must be stated, because a
 * reader who assumes all-pairs separation will eventually put two accents side by side.
 *
 * Usage:
 *   node scripts/validate_palette.mjs "#1e89c7,#d6412f,#2a9e93,#b28e1e,#9b7bf0,#6d9a49"
 *   node scripts/validate_palette.mjs "<csv>" --surface "#141110"
 *
 * Exits non-zero if the worst ADJACENT separation falls below --min (default 10), so this can be
 * a build gate rather than a thing someone remembers to look at.
 */

const args = process.argv.slice(2)
const csv = args.find((a) => !a.startsWith('--'))
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
if (!csv) {
  console.error('usage: validate_palette.mjs "#aabbcc,#ddeeff,..." [--surface #141110] [--min 10]')
  process.exit(2)
}
const COLOURS = csv.split(',').map((c) => c.trim())
const SURFACE = opt('surface', '#141110')
const MIN = Number(opt('min', '10'))

/* ---------------------------------------------------------------- colour */

const hex2rgb = (h) => {
  const s = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c) => {
  const x = Math.min(1, Math.max(0, c))
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055
}

function rgb2lab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(toLinear)
  const X = 0.4124 * R + 0.3576 * G + 0.1805 * B
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const Z = 0.0193 * R + 0.1192 * G + 0.9505 * B
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(X / 0.95047), f(Y / 1.0), f(Z / 1.08883)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** Viénot, Brettel & Mollon 1999 — the simulation this project's figures are stated against. */
function simulate(hex, mode) {
  if (mode === 'normal') return hex
  const [r, g, b] = hex2rgb(hex).map(toLinear)
  let L = 0.31399 * r + 0.63951 * g + 0.04649 * b
  let M = 0.15537 * r + 0.75789 * g + 0.0867 * b
  const S = 0.01775 * r + 0.10944 * g + 0.87262 * b
  if (mode === 'deuteranopia') M = 0.494207 * L + 1.24827 * S
  else if (mode === 'protanopia') L = 2.02344 * M - 2.52581 * S
  const out = [
    5.47221 * L - 4.6419 * M + 0.16963 * S,
    -1.1252 * L + 2.29317 * M - 0.1678 * S,
    0.0298 * L - 0.19318 * M + 1.16364 * S,
  ].map((c) => Math.round(toSrgb(c) * 255))
  return `#${out.map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, '0')).join('')}`
}

function ciede2000(l1, l2) {
  const [L1, a1, b1] = l1
  const [L2, a2, b2] = l2
  const C1 = Math.hypot(a1, b1)
  const C2 = Math.hypot(a2, b2)
  const Cb = (C1 + C2) / 2
  const G = Cb > 0 ? 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))) : 0
  const a1p = (1 + G) * a1
  const a2p = (1 + G) * a2
  const C1p = Math.hypot(a1p, b1)
  const C2p = Math.hypot(a2p, b2)
  const deg = (x) => ((x * 180) / Math.PI + 360) % 360
  const h1p = C1p === 0 ? 0 : deg(Math.atan2(b1, a1p))
  const h2p = C2p === 0 ? 0 : deg(Math.atan2(b2, a2p))
  const dLp = L2 - L1
  const dCp = C2p - C1p
  let dhp = 0
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p
    if (dhp > 180) dhp -= 360
    else if (dhp < -180) dhp += 360
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360)
  const Lb = (L1 + L2) / 2
  const Cbp = (C1p + C2p) / 2
  let hb = h1p + h2p
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hb += h1p + h2p < 360 ? 360 : -360
    hb /= 2
  }
  const rad = (d) => (d * Math.PI) / 180
  const T =
    1 -
    0.17 * Math.cos(rad(hb - 30)) +
    0.24 * Math.cos(rad(2 * hb)) +
    0.32 * Math.cos(rad(3 * hb + 6)) -
    0.2 * Math.cos(rad(4 * hb - 63))
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const Sc = 1 + 0.045 * Cbp
  const Sh = 1 + 0.015 * Cbp * T
  const Rt =
    Cbp > 0
      ? -2 *
        Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) *
        Math.sin(rad(60 * Math.exp(-(((hb - 275) / 25) ** 2))))
      : 0
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  )
}

const MODES = ['normal', 'deuteranopia', 'protanopia']
const sep = (a, b, mode) =>
  ciede2000(rgb2lab(hex2rgb(simulate(a, mode))), rgb2lab(hex2rgb(simulate(b, mode))))

/** WCAG relative luminance contrast, so an accent is legible on the panel and not merely distinct. */
function contrast(a, b) {
  const lum = (h) => {
    const [r, g, bl] = hex2rgb(h).map(toLinear)
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/* ---------------------------------------------------------------- report */

console.log(`palette: ${COLOURS.join(' ')}`)
console.log(`surface: ${SURFACE}\n`)

let worstAdjacent = Infinity
let worstAdjacentPair = ''
for (const mode of MODES) {
  let w = Infinity
  let pair = ''
  for (let i = 0; i < COLOURS.length - 1; i++) {
    const d = sep(COLOURS[i], COLOURS[i + 1], mode)
    if (d < w) {
      w = d
      pair = `${COLOURS[i]}|${COLOURS[i + 1]}`
    }
  }
  console.log(`  adjacent  ${mode.padEnd(13)} worst dE ${w.toFixed(1).padStart(5)}  (${pair})`)
  if (w < worstAdjacent) {
    worstAdjacent = w
    worstAdjacentPair = `${pair} under ${mode}`
  }
}

console.log('')
let worstAll = Infinity
let worstAllPair = ''
for (const mode of MODES) {
  let w = Infinity
  let pair = ''
  for (let i = 0; i < COLOURS.length; i++) {
    for (let j = i + 1; j < COLOURS.length; j++) {
      const d = sep(COLOURS[i], COLOURS[j], mode)
      if (d < w) {
        w = d
        pair = `${COLOURS[i]}|${COLOURS[j]}`
      }
    }
  }
  console.log(`  all-pairs ${mode.padEnd(13)} worst dE ${w.toFixed(1).padStart(5)}  (${pair})`)
  if (w < worstAll) {
    worstAll = w
    worstAllPair = `${pair} under ${mode}`
  }
}

console.log('')
const thin = COLOURS.filter((c) => contrast(c, SURFACE) < 3)
for (const c of COLOURS) {
  console.log(`  contrast on ${SURFACE}: ${c} = ${contrast(c, SURFACE).toFixed(2)}:1`)
}

console.log('')
console.log(`worst ADJACENT : dE ${worstAdjacent.toFixed(1)}  (${worstAdjacentPair})`)
console.log(`worst ALL-PAIRS: dE ${worstAll.toFixed(1)}  (${worstAllPair})`)
if (thin.length) console.log(`below 3:1 on the panel: ${thin.join(', ')}`)

if (worstAdjacent < MIN) {
  console.error(`\nFAIL: worst adjacent dE ${worstAdjacent.toFixed(1)} is below the --min of ${MIN}`)
  process.exit(1)
}
console.log(`\nOK: worst adjacent dE ${worstAdjacent.toFixed(1)} >= ${MIN}`)
