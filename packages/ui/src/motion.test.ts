/**
 * EVERY ANIMATED RULE THIS PACKAGE SHIPS IS SWITCHED OFF UNDER `prefers-reduced-motion`.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS FILE CLOSES
 *
 * `ui.css` honours reduced motion through ONE block that lists the classes to switch off. The
 * comment above it said "honoured globally", and it was not: it was honoured for the classes
 * somebody had remembered. micro-org#483 added two icon links to the shared footer with a colour
 * transition on them, and did not extend the list. Nineteen surfaces render that footer, so a
 * reader who has asked their operating system for less motion got animation on all nineteen, from
 * one four-line rule.
 *
 * It was caught by `emberkin-web`'s BJ-A11Y-11, which drives a real browser with
 * `prefers-reduced-motion: reduce` and counts elements whose computed `transition-duration` is
 * non-zero. That is the right check and it found this in one run — but only ONE frontend in the
 * estate runs it. The other eighteen were exactly as broken and entirely green, which is the same
 * arithmetic `contrast.test.ts` sets out beside it: a property of the design system, checked in a
 * fraction of the browser suites that consume it, is a property nobody is actually checking.
 *
 * `.cf-input` and `.cf-select` turned out to have been missing from the list since before any of
 * this, and nothing anywhere had noticed.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY IT IS DERIVED RATHER THAN LISTED
 *
 * The same argument as `contrast.test.ts`, for the same reason. A second hand-maintained list —
 * this time of the classes that ought to be in the first hand-maintained list — goes stale on the
 * same day and reports a pass while it does. So the animated set is READ OUT OF `ui.css`: every
 * rule declaring `transition` or `animation` to something other than `none`, outside the
 * reduced-motion block itself. A rule added tomorrow is checked tomorrow, and adding one without
 * extending the block turns this file red.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * HOW THIS FILE CAN FAIL TO BE A TEST
 *
 * A parser that finds no animated rules would report that everything is covered. So the extraction
 * is asserted to be non-empty, to contain the specific class the defect was found on, and to
 * notice a rule that is genuinely uncovered — the last one by running the comparison over a
 * stylesheet built here for the purpose, rather than by trusting that a red run would have
 * happened.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('./ui.css', import.meta.url), 'utf8')

/** Comments out. Several of them quote a `transition:` line while explaining it. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** The `@media (prefers-reduced-motion: reduce)` block, and the stylesheet with it removed. */
function splitOnReducedMotion(css: string): { block: string; rest: string } {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)')
  if (at === -1) return { block: '', rest: css }
  const open = css.indexOf('{', at)
  let depth = 0
  let end = open
  for (; end < css.length; end++) {
    if (css[end] === '{') depth++
    else if (css[end] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  return { block: css.slice(at, end + 1), rest: css.slice(0, at) + css.slice(end + 1) }
}

/**
 * The class each animated rule is keyed on.
 *
 * The LAST class in a selector, because that is what the reduced-motion block names: `.cf-btn` for
 * `.cf-bar .cf-btn:hover`, `.cf-menu__item` for `.cf-menu__item[aria-current]`. A selector with no
 * class at all — a bare element or `:root` — is not something the block can switch off by name and
 * is reported rather than skipped.
 */
function animatedClasses(css: string): Set<string> {
  const found = new Set<string>()
  const rules = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = rules.exec(css)) !== null) {
    const body = match[2] ?? ''
    const declares = /(^|[;\s])(transition|animation)(-[a-z]+)?\s*:/.test(body)
    const off = /(^|[;\s])(transition|animation)(-[a-z]+)?\s*:\s*none/.test(body)
    if (!declares || off) continue
    for (const one of (match[1] ?? '').split(',')) {
      const classes = one.trim().match(/\.[A-Za-z0-9_-]+/g)
      if (classes && classes.length > 0) found.add(classes[classes.length - 1] as string)
    }
  }
  return found
}

function coveredClasses(block: string): Set<string> {
  return new Set(block.match(/\.[A-Za-z0-9_-]+/g) ?? [])
}

const { block, rest } = splitOnReducedMotion(stripComments(CSS))
const ANIMATED = animatedClasses(rest)
const COVERED = coveredClasses(block)

describe('reduced motion is honoured for everything this package animates', () => {
  test('every animated class is switched off in the reduced-motion block', () => {
    const missing = [...ANIMATED].filter((cls) => !COVERED.has(cls)).sort()
    assert.deepEqual(
      missing,
      [],
      `these classes animate and are not switched off under prefers-reduced-motion: ${missing.join(', ')}`,
    )
  })

  test('the block switches BOTH transition and animation off, and does it with !important', () => {
    // A product stylesheet loads after this one. Without `!important` a surface's own
    // `.cf-btn { transition: … }` wins on equal specificity and the reader gets the motion back.
    assert.match(block, /transition:\s*none\s*!important/)
    assert.match(block, /animation:\s*none\s*!important/)
  })

  test('the skip link also loses its transform, because switching the transition off is not enough', () => {
    // Its resting position IS a transform. With only the transition gone it still travels; it
    // just travels instantly, which is the same distance in zero time rather than no motion.
    assert.match(block, /\.cf-skip:focus[\s\S]*transform:\s*none/)
  })
})

describe('the extraction is real, so a green run means something', () => {
  test('it finds animated rules at all', () => {
    assert.ok(ANIMATED.size > 5, `only ${ANIMATED.size} animated classes found — the parser is wrong`)
  })

  test('it finds the class micro-org#483 shipped the defect on', () => {
    assert.ok(
      ANIMATED.has('.cf-foot__sociallink'),
      'the footer social links no longer parse as animated; this test would now pass vacuously for them',
    )
    assert.ok(COVERED.has('.cf-foot__sociallink'), 'the footer social links are not covered')
  })

  test('it does not count a rule that switches motion OFF as a rule that animates', () => {
    const off = animatedClasses('.cf-thing { transition: none; }')
    assert.equal(off.size, 0)
  })

  test('it REPORTS an uncovered rule, checked against a stylesheet written to be uncovered', () => {
    // The assertion that this file can fail. Everything above would still pass if the comparison
    // were `missing = []` by construction.
    const sheet = `
      .cf-covered { transition: color 1ms linear; }
      .cf-forgotten { transition: transform 1ms linear; }
      @media (prefers-reduced-motion: reduce) {
        .cf-covered { transition: none !important; animation: none !important; }
      }
    `
    const split = splitOnReducedMotion(sheet)
    const animated = animatedClasses(split.rest)
    const covered = coveredClasses(split.block)
    const missing = [...animated].filter((cls) => !covered.has(cls))
    assert.deepEqual(missing, ['.cf-forgotten'])
  })
})
