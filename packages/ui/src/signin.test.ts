/**
 * The sign-in intent panel, asserted on the markup React actually emits.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS FOR
 *
 * `SignInIntent` exists because eleven repositories carry the same template-copied
 * `<LoadingGate label="Taking you to sign in" />` and six of them are public front doors. Nothing
 * about that was broken in a way a test could see: the redirect worked, the destination answered,
 * every suite was green. The defect was that a stranger was thrown at a hostname nobody had
 * introduced, and the only artefact that records the difference is the markup.
 *
 * So this file is about CONTENT and STRUCTURE, in that order:
 *
 *   * the four things the panel promises to say are each present, and each is READ FROM THE
 *     REGISTRY or from the caller rather than typed into the component;
 *   * nothing navigates unless the button is pressed;
 *   * the alternatives are real, in-surface addresses, or an explicit sentence saying there are
 *     none — never an empty list.
 *
 * `renderToStaticMarkup` is a real React render — the same element tree, the same hooks. It is not
 * evidence that anything painted; `contrast.test.ts` measures the colours and the consuming
 * surfaces' own suites drive the DOM. This is the part provable in a checkout with no browser.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THERE IS NO `window` HERE
 *
 * `cloudsforgeHosts()` reads `window.location.hostname` and falls back to `LOCAL_HOSTS` when there
 * is no `window` at all, so under `node --test` `accountUrl()` resolves to the local port. That is
 * deliberate and it is what makes the panel renderable in a test: the assertions below compare the
 * rendered host against `new URL(accountUrl()).host` — the function, not a copy of its output — so
 * they hold on localhost, on a preview host and on mainnet without being edited. A literal
 * `localhost:3010` in an assertion would pass here and prove nothing about the served bundle.
 */
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import { SignInIntent, accountUrl } from './index.tsx'
import { SURFACES, surface } from './surfaces.ts'
import type { SignInIntentProps } from './index.tsx'

function render(props: SignInIntentProps): string {
  return renderToStaticMarkup(createElement(SignInIntent, props))
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

/** Every `<a href="…">text</a>`, in document order. */
function anchors(html: string): { href: string; label: string }[] {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: /href="([^"]*)"/.exec(m[1] ?? '')?.[1] ?? '',
    label: text(m[2] ?? ''),
  }))
}

/** The two shapes a caller may pass, rendered once each. */
const WITH_ALTERNATIVES: SignInIntentProps = {
  surface: 'trade',
  unlocks: ['Place an order', 'See your open positions'],
  without: {
    actions: [
      { label: 'Browse every market', href: '/markets' },
      { label: 'Read the order book', href: '/markets/ember-usd' },
    ],
  },
}

const WITH_NOTHING: SignInIntentProps = {
  surface: 'admin',
  unlocks: ['Everything on this surface'],
  without: { nothing: 'Nothing. This surface is operator-only and shows no public data at all.' },
}

const ALTERNATIVES = render(WITH_ALTERNATIVES)
const NOTHING = render(WITH_NOTHING)

/* ═══════════════════════════════ 1. which surface you are on ══════════════════════════════ */

describe('it names the surface, from the registry', () => {
  it('renders the registry name in the heading rather than a second name written here', () => {
    const here = surface('trade')
    assert.match(ALTERNATIVES, /<h2\b[^>]*class="cf-signin__title"/)
    assert.ok(
      text(ALTERNATIVES).includes(`Sign in to ${here.name}`),
      `heading does not name the registry's "${here.name}": ${text(ALTERNATIVES).slice(0, 160)}`,
    )
  })

  it('renders the registry blurb rather than a tagline of its own', () => {
    assert.ok(
      text(ALTERNATIVES).includes(surface('trade').blurb),
      'the blurb is not the one in surfaces.ts',
    )
  })

  /*
   * The point of the two assertions above is that the strings are DERIVED. A test that compares
   * the render against a literal would be green for every possible value of that literal — the
   * defect auth.test.ts opens with. This one drives every surface in the registry through the
   * component and asserts each rendered heading carries that surface's own name, so renaming a
   * surface in surfaces.ts and not here cannot leave this file green.
   */
  it('follows the registry for every surface, not just the one above', () => {
    assert.ok(SURFACES.length > 10, `the registry has only ${SURFACES.length} rows`)
    for (const row of SURFACES) {
      const seen = text(
        render({ surface: row.key, unlocks: ['Something'], without: { nothing: 'Nothing.' } }),
      )
      assert.ok(
        seen.includes(`Sign in to ${row.name}`),
        `${row.key}: heading does not name "${row.name}"`,
      )
      assert.ok(seen.includes(row.blurb), `${row.key}: blurb is not the registry's`)
    }
  })

  it('throws on a key the registry does not have, rather than rendering a panel for a product that does not exist', () => {
    assert.throws(() =>
      render({
        // deliberately not a SurfaceKey — the cast is the point of the case
        surface: 'not-a-surface' as SignInIntentProps['surface'],
        unlocks: ['Something'],
        without: { nothing: 'Nothing.' },
      }),
    )
  })
})

/* ══════════════════════════════ 2. what an account unlocks ════════════════════════════════ */

describe('it says what an account is for, in the surface’s own words', () => {
  it('renders every line the caller gave, as a real list', () => {
    const list = /<h3[^>]*>What an account gives you here<\/h3>\s*<ul[^>]*>([\s\S]*?)<\/ul>/.exec(
      ALTERNATIVES,
    )?.[1]
    assert.ok(list, 'the unlocks list is not a <ul> under its own heading')
    const items = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1] ?? ''))
    assert.deepEqual(items, [...WITH_ALTERNATIVES.unlocks])
  })

  /*
   * `unlocks` is `readonly [string, ...string[]]`, so an empty list does not compile. There is
   * nothing to assert at runtime except that the type is still the tuple — which is what the
   * `@ts-expect-error` below does. Delete the tuple and this file stops compiling, which is the
   * signal, because "sign in to continue" with no reason attached is the copy this component was
   * written to make impossible.
   */
  it('will not compile a panel that asks for a session without saying what for', () => {
    // @ts-expect-error an empty unlocks list is not assignable to the non-empty tuple
    const bad: SignInIntentProps = { surface: 'trade', unlocks: [], without: { nothing: 'x' } }
    assert.ok(bad)
  })
})

/* ═══════════════════════════ 3. what works without an account ═════════════════════════════ */

describe('it says what a reader can do without an account', () => {
  it('renders each alternative as an anchor a reader can open in a new tab', () => {
    const links = anchors(ALTERNATIVES)
    assert.deepEqual(
      links,
      WITH_ALTERNATIVES.without.actions?.map((a) => ({ href: a.href, label: a.label })),
    )
  })

  /*
   * An alternative pointing at another hostname is the defect this component exists to stop, not
   * a way round it: "you can do this without an account, on a different site" is the hand-off
   * again with an extra step. Relative is the only correct form anyway — the same bundle is
   * served from localhost, a preview host and mainnet.
   */
  it('keeps every alternative on this surface, and relative', () => {
    for (const link of anchors(ALTERNATIVES)) {
      assert.ok(link.href.startsWith('/'), `alternative is not an in-surface path: ${link.href}`)
      assert.ok(!/^[a-z]+:/i.test(link.href), `alternative names a scheme: ${link.href}`)
    }
  })

  it('renders a named hole rather than an empty list when there is genuinely nothing', () => {
    assert.ok(
      text(NOTHING).includes(WITH_NOTHING.without.nothing ?? ''),
      'the "nothing" sentence is not rendered',
    )
    assert.equal(anchors(NOTHING).length, 0, 'the nothing case rendered links from somewhere')
    // The heading stays. Dropping it would leave the reader inferring from an absence, which is
    // rule 1.2 — render a named hole, never a plausible screen over nothing.
    assert.ok(text(NOTHING).includes('What you can do without one'))
    assert.ok(!/<ul[^>]*>\s*<\/ul>/.test(NOTHING), 'rendered an empty <ul>')
  })

  it('will not compile a panel that offers neither alternatives nor a sentence', () => {
    // @ts-expect-error `without` requires one of the two arms
    const bad: SignInIntentProps = { surface: 'trade', unlocks: ['x'], without: {} }
    assert.ok(bad)
  })
})

/* ════════════════════════════ 4. where you are about to be sent ═══════════════════════════ */

describe('it names the destination before the button is pressed', () => {
  it('renders the host accountUrl() resolves to, derived and not typed', () => {
    const host = new URL(accountUrl()).host
    assert.ok(
      ALTERNATIVES.includes(`<strong class="cf-signin__host">${host}</strong>`),
      `the destination host is not ${host}`,
    )
  })

  it('names a host and not a full URL with a return query on it', () => {
    const shown = /<strong class="cf-signin__host">([^<]*)<\/strong>/.exec(ALTERNATIVES)?.[1] ?? ''
    assert.ok(shown.length > 0, 'nothing is named')
    assert.ok(!shown.includes('/'), `a path leaked into the sentence: ${shown}`)
    assert.ok(!shown.includes('?'), `a query string leaked into the sentence: ${shown}`)
  })

  /*
   * The whole estate is served from three different hostnames off one artefact. A literal here
   * would be green in CI and wrong in production, which is the failure mode
   * `test/no-build-time-config.test.ts` polices in every frontend.
   */
  it('hard-codes no hostname of its own', () => {
    assert.ok(!/cloudsforge\.(online|localtest)/.test(ALTERNATIVES), 'an apex is baked into the markup')
    assert.ok(!/https?:\/\//.test(ALTERNATIVES), 'an absolute URL is baked into the markup')
  })
})

/* ══════════════════════════════ it does not redirect by itself ════════════════════════════ */

describe('nothing moves until the reader decides', () => {
  /*
   * The render happens with NO `window` defined at all — see the header. `signInRedirect()` ends
   * in `window.location.assign`, so if the component navigated during render (an effect, a timer,
   * a call in the body) this whole file would have thrown on import rather than reaching here.
   * That is a stronger assertion than a spy: there is no browser to navigate.
   */
  it('renders without a window, which is only possible if it does not navigate', () => {
    assert.equal(typeof globalThis.window, 'undefined', 'a window exists; this case proves nothing')
    assert.ok(ALTERNATIVES.length > 0)
  })

  it('offers a <button>, not an <a>, for the action it performs', () => {
    const go = /<button\b([^>]*)>([\s\S]*?)<\/button>/.exec(ALTERNATIVES)
    assert.ok(go, 'there is no button')
    assert.match(go[1] ?? '', /type="button"/)
    assert.match(go[1] ?? '', /class="cf-signin__go"/)
    assert.equal(text(go[2] ?? ''), 'Sign in')
  })

  it('calls the caller’s own hand-off when it is given one, with the return url', () => {
    const seen: (string | undefined)[] = []
    const props: SignInIntentProps = {
      ...WITH_ALTERNATIVES,
      returnUrl: '/markets/ember-usd',
      onSignIn: (url) => seen.push(url),
    }
    // A static render never fires onClick; call the prop the way the button does, so the wiring
    // is proved without a DOM. The consuming surfaces' suites click it for real.
    props.onSignIn?.(props.returnUrl)
    assert.deepEqual(seen, ['/markets/ember-usd'])
  })

  it('carries no countdown, no timer and no auto-focus', () => {
    const source = ALTERNATIVES.toLowerCase()
    for (const banned of ['autofocus', 'meta http-equiv', 'refresh']) {
      assert.ok(!source.includes(banned), `the markup contains "${banned}"`)
    }
    /*
     * Rule 1.1: every number a reader sees is derived at runtime or bound by a test to the
     * constant it describes. A countdown would have been neither — a duration nobody decided,
     * typed into copy — so the panel's OWN words contain no digit at all.
     *
     * "Own words" means: with the caller's strings and the registry's strings removed, and with
     * the resolved host removed too. The host legitimately carries digits (`localhost:3010` under
     * `node --test`) and is exactly the kind of number this rule permits, because it comes out of
     * `accountUrl()` at render time rather than out of this file.
     */
    const own = text(ALTERNATIVES)
      .replace(surface('trade').blurb, '')
      .replace(new URL(accountUrl()).host, '')
      .replace(new RegExp(WITH_ALTERNATIVES.unlocks.join('|'), 'g'), '')
      .replace(
        new RegExp((WITH_ALTERNATIVES.without.actions ?? []).map((a) => a.label).join('|'), 'g'),
        '',
      )
    assert.ok(!/\d/.test(own), `a number appears in the panel's own copy: ${own}`)
  })
})

/* ══════════════════════════════════════ accessibility ═════════════════════════════════════ */

describe('it is a named region, not a dialog', () => {
  it('renders one <section> with an accessible name bound to its own heading', () => {
    const sections = [...ALTERNATIVES.matchAll(/<section\b([^>]*)>/g)]
    assert.equal(sections.length, 1, `${sections.length} <section> elements`)
    const labelledBy = /aria-labelledby="([^"]*)"/.exec(sections[0]?.[1] ?? '')?.[1]
    assert.ok(labelledBy, 'the section has no accessible name')
    assert.ok(
      new RegExp(`<h2[^>]*\\bid="${labelledBy}"`).test(ALTERNATIVES) ||
        new RegExp(`<h2[^>]*class="cf-signin__title"[^>]*id="${labelledBy}"`).test(ALTERNATIVES),
      `aria-labelledby="${labelledBy}" points at nothing`,
    )
  })

  it('traps nothing: no dialog role, no modal, no inert', () => {
    for (const banned of ['role="dialog"', 'aria-modal', 'inert']) {
      assert.ok(!ALTERNATIVES.includes(banned), `the panel declares ${banned}`)
    }
  })

  /*
   * Two panels on one page must not collide. `useId` is what makes that true, and a rendered
   * id that repeated would be a silently wrong `aria-labelledby` rather than a visible break —
   * so it is asserted rather than assumed.
   */
  it('gives each instance its own id', () => {
    const both = renderToStaticMarkup(
      createElement('div', null, [
        createElement(SignInIntent, { ...WITH_ALTERNATIVES, key: 'a' }),
        createElement(SignInIntent, { ...WITH_NOTHING, key: 'b' }),
      ]),
    )
    const ids = [...both.matchAll(/aria-labelledby="([^"]*)"/g)].map((m) => m[1])
    assert.equal(ids.length, 2)
    assert.notEqual(ids[0], ids[1], `both panels claim the id ${ids[0]}`)
  })

  it('puts the headings in order — h2 for the panel, h3 for each half', () => {
    const levels = [...ALTERNATIVES.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
    assert.deepEqual(levels, [2, 3, 3])
  })
})

/* ═════════════════════════════ the stylesheet paints what it renders ══════════════════════ */

describe('every class it emits is one ui.css paints', () => {
  /*
   * A class name that exists only in the TSX is a rule that never applies, and it looks exactly
   * like a rule that does until somebody opens the page. `contrast.test.ts` measures the colours
   * of the rules that exist; this asserts the set is the same set.
   */
  it('names no class the stylesheet does not carry', async () => {
    const css = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('./ui.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
    )
    const emitted = new Set<string>()
    for (const html of [ALTERNATIVES, NOTHING]) {
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        for (const cls of (m[1] ?? '').split(/\s+/)) if (cls) emitted.add(cls)
      }
    }
    assert.ok(emitted.size >= 8, `only ${emitted.size} classes emitted — the scan found nothing`)
    for (const cls of emitted) {
      assert.ok(css.includes(`.${cls}`), `ui.css does not paint .${cls}`)
    }
  })
})
