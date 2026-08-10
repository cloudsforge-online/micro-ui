/**
 * The promise and the mechanism, held together.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS FILE IS THE GUARD FOR
 *
 * `CookieBanner` has told readers "you can change your mind at any time" on every one of the
 * eighteen surfaces that render it, since the day it shipped. `revokeConsent` — the function that
 * would have made that true — had ZERO CALL SITES anywhere in the estate. There was nothing to
 * press. Every suite was green, `consent.test.ts` proved at length that `revokeConsent` withdraws
 * correctly, and none of that mattered because no control ever called it.
 *
 * That is the shape of failure this file exists for, and it is not a bug in a function: it is two
 * true statements about separate files that are false when put together. So the cases below are
 * about the JOIN.
 *
 *   * the banner's copy names a control, and composes that name from the constant the control
 *     renders — so the sentence and the label cannot be edited apart;
 *   * the control is mounted by the component that makes the promise, rather than by a footer
 *     three of the eighteen surfaces do not render;
 *   * the control's handler is `revokeConsent` ITSELF, so "change your answer" cannot quietly
 *     become a wrapper that records a `no` and forgets to delete the cookies.
 *
 * `consent.test.ts` already proves what `revokeConsent` DOES, including that it withdraws across
 * surfaces and that the banner comes back afterwards. Nothing here restates that. What is asserted
 * here is only the part that was missing: that anything calls it at all.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY SOME OF THESE READ THE SOURCE
 *
 * `CookieBanner` decides what to render from `localStorage` and from a `<meta>` tag, both read in
 * an effect, because reading them in the render body is what makes a component hydrate to a
 * different tree than it rendered. Effects do not run under `renderToStaticMarkup`, so the
 * answered branch is not reachable from a static render and there is no browser in this package to
 * mount into. The wiring is therefore asserted against the module text, which is the same
 * technique `dist.test.ts` and `contrast.test.ts` use, and it is scoped to ONE function body so a
 * match somewhere else in a 1,700-line module cannot satisfy it.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import { CONSENT_CHOICES_LABEL, ConsentChoices } from './index.tsx'

const SOURCE = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')

/**
 * One exported function's body, and nothing else in the module.
 *
 * A bare `SOURCE.includes(...)` would be satisfied by the doc comment that describes the thing, by
 * a different component, or by this file's own name appearing in an export list — none of which
 * put a control on the page.
 */
function bodyOf(name: string): string {
  const start = SOURCE.indexOf(`export function ${name}(`)
  assert.notEqual(start, -1, `there is no exported function called ${name}`)
  const rest = SOURCE.slice(start + 1)
  const end = rest.indexOf('\nexport ')
  return end === -1 ? rest : rest.slice(0, end)
}

/** The text a reader sees: tags removed, entities folded, whitespace flattened. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|\s+/g, ' ')
    .trim()
}

const CONTROL = renderToStaticMarkup(createElement(ConsentChoices))

/* ═════════════════════════════════ the control exists at all ══════════════════════════════════ */

describe('there is something to press', () => {
  it('renders one button, with the named label as its whole accessible name', () => {
    const buttons = [...CONTROL.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    assert.equal(buttons.length, 1, `${buttons.length} buttons`)
    assert.match(buttons[0]?.[1] ?? '', /type="button"/)
    assert.equal(text(buttons[0]?.[2] ?? ''), CONSENT_CHOICES_LABEL)
  })

  /*
   * A button and not a link. It acts on this page — it withdraws consent, deletes the cookies
   * already written and brings the banner back — and an anchor would offer a destination there is
   * none of. The distinction is the same one `MiningControl` and `accountSettingsUrl` make.
   */
  it('is a button and not a link, because it does something rather than going somewhere', () => {
    assert.ok(!CONTROL.includes('<a '), 'the control is an anchor')
    assert.ok(!CONTROL.includes('href='), 'the control offers a destination')
  })

  /*
   * The one mechanism for withdrawing consent on the whole estate may not be an icon, a bare
   * glyph, or text only a hover reveals. If a reader cannot read the word, the promise is as false
   * as it was when there was no control at all.
   */
  it('says a word, rather than being a glyph a reader has to guess at', () => {
    assert.ok(text(CONTROL).length >= 8, `the control reads "${text(CONTROL)}"`)
    assert.ok(!CONTROL.includes('cf-sr'), 'the label is hidden from sighted readers')
    assert.ok(!/aria-label=/.test(CONTROL), 'the name is an attribute rather than the visible text')
  })

  it('paints every class it emits', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const emitted = [...CONTROL.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
      (m[1] ?? '').split(/\s+/).filter(Boolean),
    )
    assert.ok(emitted.length >= 2, `only ${emitted.length} classes emitted`)
    for (const cls of emitted) assert.ok(css.includes(`.${cls}`), `ui.css does not paint .${cls}`)
  })
})

/* ═══════════════════════════════ the promise names the mechanism ══════════════════════════════ */

describe('the sentence and the control cannot be edited apart', () => {
  it('composes the banner’s promise from the constant the control renders', () => {
    const banner = bodyOf('CookieBanner')
    assert.ok(
      banner.includes('CONSENT_CHOICES_LABEL'),
      'the banner names a control by writing its own copy of the label, or names none at all',
    )
  })

  /*
   * The exact words that were false. If they come back, they come back with no mechanism attached,
   * because "change your mind at any time" states no address — which is what made the original
   * sentence unfalsifiable by anything except a reader trying it.
   */
  it('never ends the promise without naming where it is kept', () => {
    // Comments out first: they are the explanation, not the copy, and a long one between the
    // clause and the label would push the label out of the window below for no reason a reader
    // could see on the page.
    const banner = bodyOf('CookieBanner')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\s+/g, ' ')
    const promise = /change your (?:mind|answer) at any time/.exec(banner)
    assert.ok(promise, 'the banner no longer offers a change of answer at all')
    // Whatever follows the clause, the label has to be in it before the sentence is over. The
    // window is generous on purpose: it is the JSX between the words, not the words.
    const after = banner.slice((promise.index ?? 0) + promise[0].length, (promise.index ?? 0) + 400)
    assert.ok(
      after.includes('CONSENT_CHOICES_LABEL'),
      `the promise ends without naming the control that keeps it: "…${after.slice(0, 120)}"`,
    )
  })

  it('mounts the control from the component that makes the promise', () => {
    const banner = bodyOf('CookieBanner')
    assert.ok(
      /<ConsentChoices\s*\/>/.test(banner),
      'the banner promises a change of answer and renders no control for it',
    )
  })

  /*
   * Three of the eighteen surfaces that render the banner (micro-explorer-web, micro-site,
   * micro-network-site) render their own footer rather than `CloudsForgeFooter`. Putting the
   * control there would have left the sentence false on exactly the surfaces nobody would check,
   * so this asserts it is NOT there — the placement is the fix, not an incidental.
   */
  it('does not depend on the shared footer, which three of the eighteen surfaces do not render', () => {
    assert.ok(
      !/<ConsentChoices\s*\/>/.test(bodyOf('CloudsForgeFooter')),
      'the control moved into the shared footer, which three surfaces do not mount',
    )
  })
})

/* ══════════════════════════════ the mechanism is the real one ═════════════════════════════════ */

describe('pressing it withdraws for real', () => {
  /*
   * `revokeConsent` and not a local handler. `consent.ts` documents why withdrawal has to do more
   * than record a `no` — a script already on the page cannot be unloaded, so the cookies it wrote
   * are deleted and Consent Mode is told to stop, each against both the exact host and the
   * dot-prefixed parent. A wrapper written here would be a second, shorter description of that,
   * and the shorter one always wins by being the one somebody edits.
   */
  it('wires the button straight to revokeConsent, with nothing in between', () => {
    assert.match(bodyOf('ConsentChoices'), /onClick=\{revokeConsent\}/)
  })

  /*
   * THE ORIGINAL DEFECT, STATED AS A CASE. `revokeConsent` was exported, documented, and proved
   * correct by `consent.test.ts` — and called by nothing. This fails the moment that is true
   * again, which no test in this package could previously do.
   */
  it('gives revokeConsent a call site, which it did not have', () => {
    const calls = [...SOURCE.matchAll(/\brevokeConsent\b/g)].length
    // One import, one re-export, one handler. Fewer than three means the wiring is gone.
    assert.ok(calls >= 3, `revokeConsent appears ${calls} times in index.tsx`)
  })
})
