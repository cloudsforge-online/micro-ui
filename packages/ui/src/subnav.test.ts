/**
 * The sub-nav: the row of this surface's own sections, under the company bar.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS FOR
 *
 * The component is four lines. Almost nothing here is about it; what is asserted is the CSS, and
 * the reason is the measurement that produced the component in the first place.
 *
 * On 2026-08-10 ten frontends declared this strip in their own stylesheet, under six different
 * class prefixes (`wt-`, `mk-`, `ex-`, `fs-`, `dp-`, `ln-`, `bw-`), from what was plainly one
 * original that had been copied and then edited in place. Three of the differences were visible to
 * a reader:
 *
 *   1. Only ONE of the ten survived a narrow viewport. `hub-web` carried `white-space: nowrap` and
 *      `overflow-x: auto`; the other nine had a `display: flex` row with neither, so a phone got
 *      six labels squeezed and broken mid-word with no way to reach the ones past the edge.
 *   2. Five of the ten set `max-width: 76rem` — 1216px — while `.cf-bar__inner` and
 *      `.cf-foot__inner` use `var(--cf-max-w)`, which is 1200px. The second row of the header sat
 *      8px proud of the first on each side, on every wide screen.
 *   3. All ten were written in literals, so none of them moved when the type scale did. They still
 *      set the sections at 0.875rem while `--cf-text-md` — the body step — had been raised to
 *      1rem, which is the note `tokens.css` carries beside it.
 *
 * A copy that has drifted is not a copy anybody notices; it is ten surfaces that each look nearly
 * right. So the assertions below are about the properties that DIFFERED, each pinned to the reason
 * it mattered, and about the three-channel treatment of the current section, which is the estate's
 * standing rule and the one a private copy is most likely to reduce to a colour.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'

import { SubNav } from './index.tsx'

const CSS = readFileSync(new URL('./ui.css', import.meta.url), 'utf8')

/** One CSS rule's declaration block, by exact selector. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const found = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(CSS)
  assert.ok(found, `ui.css declares no rule for exactly \`${selector}\``)
  return found[2] ?? ''
}

describe('the sub-nav renders a labelled landmark around the caller’s links', () => {
  it('names the landmark, because a document already has one nav in it', () => {
    // The bar is the other. Two `<nav>`s with no accessible name are announced as "navigation" and
    // "navigation", which is worse than one — a screen reader user cannot tell which list they are
    // in. `label` is required rather than defaulted for that reason.
    const html = renderToStaticMarkup(
      createElement(SubNav, {
        label: 'Sections',
        children: createElement('a', { href: '/one' }, 'One'),
      }),
    )
    assert.match(html, /<nav class="cf-subnav" aria-label="Sections">/)
    assert.match(html, /<div class="cf-subnav__inner">/)
    assert.match(html, /<a href="\/one">One<\/a>/, 'the caller’s own markup did not survive')
  })

  it('leaves the links to the caller, which is what keeps routing out of this package', () => {
    // Every surface here marks the current section with react-router's `NavLink`, which owns the
    // active state. Taking a list of `{ to, label }` would mean either depending on react-router
    // from a design system or reimplementing the active-address comparison badly.
    const html = renderToStaticMarkup(createElement(SubNav, { label: 'Sections', children: null }))
    assert.match(html, /<div class="cf-subnav__inner"><\/div>/)
  })
})

describe('the strip is the same strip as the bar', () => {
  it('sticks to the bar’s own height token rather than a number copied out of it', () => {
    const rule = block('.cf-subnav')
    assert.match(rule, /top:\s*var\(--cf-bar-h\)/, 'the sub-nav’s offset is not the bar’s height')
    assert.match(rule, /position:\s*sticky/)
  })

  it('shares the measure with the bar and the footer, which five copies did not', () => {
    // The defect this closes exactly: 76rem against the bar's 1200px is 8px of overhang on each
    // side, on the row directly under it, on five surfaces.
    const rule = block('.cf-subnav__inner')
    assert.match(rule, /max-width:\s*var\(--cf-max-w\)/)
    assert.doesNotMatch(rule, /max-width:\s*\d/, 'the measure is a literal again')
    // And the two it must agree with really do use that token, so this is a shared fact rather
    // than two rules that happen to be spelled the same way.
    assert.match(block('.cf-bar__inner'), /max-width:\s*var\(--cf-max-w\)/)
    assert.match(block('.cf-foot__inner'), /max-width:\s*var\(--cf-max-w\)/)
  })

  it('stacks under the bar rather than over it', () => {
    // Two sticky rows in the wrong order is the header sliding under its own content as the page
    // moves. The bar's own z-index is read here rather than written down.
    const zOf = (rule: string): number => Number(/z-index:\s*(\d+)/.exec(rule)?.[1] ?? NaN)
    const bar = zOf(block('.cf-bar'))
    const sub = zOf(block('.cf-subnav'))
    assert.ok(Number.isFinite(bar) && Number.isFinite(sub), 'one of the two rows has no z-index')
    assert.ok(sub < bar, `the sub-nav (${sub}) is stacked over the bar (${bar})`)
  })
})

describe('it survives a phone, which nine of the ten copies did not', () => {
  it('scrolls rather than squeezing', () => {
    const inner = block('.cf-subnav__inner')
    assert.match(inner, /overflow-x:\s*auto/, 'a long sub-nav has nowhere to go')
    // The bar above it does not scroll, so a reserved scrollbar draws a line across the header and
    // grows the row by its thickness on exactly one platform.
    assert.match(inner, /scrollbar-width:\s*none/)
    assert.match(CSS, /\.cf-subnav__inner::-webkit-scrollbar\s*\{[^}]*display:\s*none/)
  })

  it('keeps each label on one line, which is the other half of scrolling', () => {
    // Without this the flex row shrinks the items instead of overflowing, and the labels break
    // mid-word — six sections in the operator console, five in Worlds.
    assert.match(block('.cf-subnav__link'), /white-space:\s*nowrap/)
  })

  it('takes the bar’s narrow gutter with it, so the two rows stay aligned', () => {
    const narrow = /@media \(max-width: 560px\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? ''
    assert.ok(narrow.length > 0, 'the narrow-viewport block is gone')
    assert.match(narrow, /\.cf-subnav__inner\s*\{[^}]*padding-inline:\s*var\(--cf-space-md\)/)
    assert.match(narrow, /\.cf-bar__inner\s*\{[^}]*padding-inline:\s*var\(--cf-space-md\)/)
  })
})

describe('it is written in the scale, so it moves when the scale does', () => {
  it('spends no literal length on spacing or type', () => {
    // The whole reason the ten copies read smaller than the bar above them: `--cf-text-md` went
    // from 0.82rem to 1rem when the body size was fixed and nothing hard-coded followed it.
    for (const selector of ['.cf-subnav', '.cf-subnav__inner', '.cf-subnav__link']) {
      const rule = block(selector)
      for (const declaration of rule.split(';')) {
        const [property, value] = declaration.split(':').map((part) => part.trim())
        if (!property || !value) continue
        if (!/^(font-size|padding|padding-inline|gap|max-width|top)$/.test(property)) continue
        assert.match(
          value,
          /var\(--cf-/,
          `${selector} sets ${property} to the literal ${value}; the scale cannot reach it`,
        )
      }
    }
  })

  it('sets the sections at the body step, not a step below it', () => {
    assert.match(block('.cf-subnav__link'), /font-size:\s*var\(--cf-text-md\)/)
  })
})

describe('the current section is marked in three channels, not one', () => {
  it('changes ink, weight and underline together', () => {
    // The standing rule, and the one a private copy reduces first. Two product accents sit inside
    // 4.6 ΔE of each other under protanopia — the measurement `tokens.css` records beside the
    // reserved status hues — so an accent underline alone tells a large minority of readers
    // nothing about which section they are in.
    const current = block('.cf-subnav__link--current')
    assert.match(current, /color:\s*var\(--cf-fg\)/)
    assert.match(current, /font-weight:\s*600/)
    assert.match(current, /border-bottom-color:\s*var\(--cf-accent\)/)
  })

  it('reserves the underline’s space on every link, so marking one moves nothing', () => {
    assert.match(block('.cf-subnav__link'), /border-bottom:\s*2px solid transparent/)
  })

  it('draws the focus ring inside the scroll container', () => {
    // An outline drawn outside a link is clipped by `overflow-x: auto` on the first and last item,
    // which is the one place a keyboard reader most needs to see where they are.
    const focus = block('.cf-subnav__link:focus-visible')
    assert.match(focus, /outline:\s*2px solid var\(--cf-accent\)/)
    assert.match(focus, /outline-offset:\s*-2px/)
  })
})
