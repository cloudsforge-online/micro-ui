/**
 * The browser mining control, asserted on the markup React actually emits.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE IS FOR
 *
 * The estate has had a working browser miner for months and almost nobody has run one, because the
 * only way to reach it is to already be on Forge Hub, know `/mine` is an address, and scroll past
 * the chain picker to a button. Nothing about that was broken in a way a test could see. The
 * defect was the ADDRESS OF THE CONTROL, and the only artefact that records it is the markup.
 *
 * So this file is about placement, state and honesty, in that order:
 *
 *   * the five states each render, and each renders the RIGHT ELEMENT — a `<button>` for the four
 *     that act, an `<a href>` for the one that is a destination;
 *   * the refused state stays keyboard reachable and says why;
 *   * the label never changes, and the state is carried by `aria-pressed` and by a change of form;
 *   * nothing anywhere implies a payment, and that is asserted against the WHOLE rendered string
 *     of every state rather than against one sentence somebody remembered to check.
 *
 * `renderToStaticMarkup` is a real React render — the same element tree, the same hooks. It is not
 * evidence that anything painted; `contrast.test.ts` measures the colours and the consuming
 * surfaces' own suites drive the DOM.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import {
  CloudsForgeBar,
  EMBER_CREDITED_CLAUSE,
  HUB_MINE_PATH,
  MiningControl,
  NOT_PAID_CLAUSE,
  formatHashrate,
  miningOnHub,
  type MiningControlProps,
} from './index.tsx'
import { surface } from './surfaces.ts'

function render(props: MiningControlProps): string {
  return renderToStaticMarkup(createElement(MiningControl, props))
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

/** Attributes of the one interactive element in a render. */
function control(html: string): { tag: string; attrs: string } {
  const m = /<(a|button)\b([^>]*)>/.exec(html)
  assert.ok(m, `no <a> or <button> in: ${html.slice(0, 200)}`)
  return { tag: m[1] ?? '', attrs: m[2] ?? '' }
}

const REASON = 'This deployment publishes no browser mining endpoint.'
const HOST_NAME = surface('hub').name
/** One of the four sentences `hub-web/src/mining/bar.ts` passes. Its shape, not its wording. */
const EMBER_REASON =
  'This account has no CloudsForge EMBER deposit address, so the mining page has to ask you where a found block should go.'

/**
 * One render per state, with `payoutsImplemented` left UNSET on four of the five.
 *
 * That is not laziness. The prop is optional and defaults to false, so leaving it off is exactly
 * what a surface that has never spoken to the pool does — and the assertions below then prove that
 * the honest sentence is what a caller gets for FREE rather than what a careful caller remembers.
 */
const STATES: Record<string, MiningControlProps> = {
  unavailable: { phase: 'unavailable', reason: REASON },
  'signed-out': { phase: 'signed-out', onSignIn: () => {} },
  idle: { phase: 'idle', onStart: () => {} },
  mining: {
    phase: 'mining',
    onStop: () => {},
    readout: { hashrate: 412_318, accepted: 9 },
  },
  elsewhere: { phase: 'elsewhere', href: 'https://example.invalid/mine', hostSurfaceName: HOST_NAME },
}

const RENDERED: Record<string, string> = Object.fromEntries(
  Object.entries(STATES).map(([key, props]) => [key, render(props)]),
)

/* ═════════════════════════════════ 1. it is there, in every state ═════════════════════════════ */

describe('every state renders a control a reader can reach', () => {
  it('renders all five', () => {
    assert.equal(Object.keys(RENDERED).length, 5)
    for (const [key, html] of Object.entries(RENDERED)) {
      assert.ok(html.includes(`cf-mine--${key}`), `${key}: no state class`)
    }
  })

  it('shows the same word in every state, so it is one control and not five', () => {
    for (const [key, html] of Object.entries(RENDERED)) {
      const label = /<span class="cf-mine__label">([^<]*)<\/span>/.exec(html)?.[1]
      assert.equal(label, 'Mine', `${key}: the label is "${label ?? '(absent)'}"`)
    }
  })

  /*
   * The accessible NAME is computed from the element's own descendants. If the description span
   * were nested inside the button — the obvious place to put it — the name would become the whole
   * paragraph, read out on every tab pass. This asserts the structure that prevents it: the only
   * text inside the interactive element is the label, and the sentence is a SIBLING.
   */
  it('names itself "Mine" and nothing else, because the sentence is a sibling and not a child', () => {
    for (const [key, html] of Object.entries(RENDERED)) {
      const inner = /<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/.exec(html)?.[1] ?? ''
      assert.equal(text(inner.replace(/<span class="cf-mine__rate[^>]*>[^<]*<\/span>/, '')), 'Mine', `${key}: the accessible name is not just the label`)
      assert.ok(!inner.includes('cf-sr'), `${key}: the description is inside the control`)
    }
  })

  it('binds aria-describedby to an element that exists in the same render', () => {
    for (const [key, html] of Object.entries(RENDERED)) {
      const id = /aria-describedby="([^"]*)"/.exec(control(html).attrs)?.[1]
      assert.ok(id, `${key}: no description`)
      assert.ok(
        new RegExp(`<span class="cf-sr" id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(html),
        `${key}: aria-describedby="${id}" points at nothing`,
      )
    }
  })

  it('gives each instance its own description id', () => {
    const both = renderToStaticMarkup(
      createElement('div', null, [
        createElement(MiningControl, { ...STATES.idle, key: 'a' } as never),
        createElement(MiningControl, { ...STATES.idle, key: 'b' } as never),
      ]),
    )
    const ids = [...both.matchAll(/aria-describedby="([^"]*)"/g)].map((m) => m[1])
    assert.equal(ids.length, 2)
    assert.notEqual(ids[0], ids[1], `both controls claim the id ${ids[0]}`)
  })
})

/* ══════════════════════════ 2. the right element for the right job ════════════════════════════ */

describe('a destination is a link and an action is a button', () => {
  it('renders the four acting states as <button type="button">', () => {
    for (const key of ['unavailable', 'signed-out', 'idle', 'mining']) {
      const { tag, attrs } = control(RENDERED[key] ?? '')
      assert.equal(tag, 'button', `${key} is a <${tag}>`)
      assert.match(attrs, /type="button"/, `${key} has no explicit type`)
      assert.ok(!attrs.includes('href'), `${key} carries an href`)
    }
  })

  /*
   * `elsewhere` is thirteen of the fourteen surfaces. An `onClick` destination cannot be
   * middle-clicked, cannot be opened in a new tab, its target cannot be copied, and it is invisible
   * to every check that reads links — which is how a wrong account link survived on nineteen
   * surfaces before `accountSettingsUrl` was made an address.
   */
  it('renders the destination state as a real anchor with a real href', () => {
    const { tag, attrs } = control(RENDERED.elsewhere ?? '')
    assert.equal(tag, 'a')
    assert.match(attrs, /href="https:\/\/example\.invalid\/mine"/)
  })
})

/* ═══════════════════════════ 3. refusal stays reachable and says why ══════════════════════════ */

describe('the refused state is announced, not removed', () => {
  it('uses aria-disabled and never the disabled attribute', () => {
    const { attrs } = control(RENDERED.unavailable ?? '')
    assert.match(attrs, /aria-disabled="true"/)
    // Anchored on a boundary that ARIA's own attribute cannot satisfy: `aria-disabled` contains
    // the word, so a bare `\bdisabled` match is green for the very markup this asserts against.
    assert.ok(!/(^|\s)disabled\b/.test(attrs), `the control is truly disabled: ${attrs}`)
  })

  it('carries the caller’s reason verbatim', () => {
    assert.ok(text(RENDERED.unavailable ?? '').includes(REASON), 'the reason is not rendered')
  })

  it('will not compile a refusal with no reason', () => {
    // @ts-expect-error `reason` is required on the unavailable arm — an unexplained refusal is the
    // state this component exists to stop rendering.
    const bad: MiningControlProps = { phase: 'unavailable' }
    assert.ok(bad)
  })

  it('marks aria-disabled on no other state', () => {
    for (const key of ['signed-out', 'idle', 'mining', 'elsewhere']) {
      assert.ok(
        !control(RENDERED[key] ?? '').attrs.includes('aria-disabled'),
        `${key} is marked unavailable`,
      )
    }
  })
})

/* ════════════════════════════ 4. running is a change of form, not hue ═════════════════════════ */

describe('the state reads without colour', () => {
  /*
   * Colour is never the only channel here — the rule the whole status vocabulary in this package
   * follows. The spark is the FORM change: it is drawn only while this browser is contributing
   * work, and the ridge underneath it is drawn in all five states so the silhouette is constant.
   */
  it('draws the ridge in every state and the spark in exactly one', () => {
    for (const [key, html] of Object.entries(RENDERED)) {
      assert.ok(html.includes('cf-mine__ridge-line'), `${key}: no ridge`)
      assert.equal(
        html.includes('cf-mine__spark'),
        key === 'mining',
        `${key}: the spark is ${key === 'mining' ? 'missing' : 'lit when nothing is running'}`,
      )
    }
  })

  it('marks the running state with aria-pressed, and offers the toggle only where there is one', () => {
    assert.match(control(RENDERED.mining ?? '').attrs, /aria-pressed="true"/)
    assert.match(control(RENDERED.idle ?? '').attrs, /aria-pressed="false"/)
    for (const key of ['unavailable', 'signed-out', 'elsewhere']) {
      assert.ok(
        !control(RENDERED[key] ?? '').attrs.includes('aria-pressed'),
        `${key} claims to be a toggle, and pressing it does not start mining`,
      )
    }
  })

  it('hides the glyph from assistive technology, because the same fact is already in words', () => {
    for (const html of Object.values(RENDERED)) {
      assert.match(html, /<svg[^>]*aria-hidden="true"/)
    }
  })

  it('animates nothing — no spinner, no pulse, no marquee', () => {
    for (const [key, html] of Object.entries(RENDERED)) {
      for (const banned of ['<animate', 'animation:', 'cf-spin']) {
        assert.ok(!html.includes(banned), `${key}: the markup contains "${banned}"`)
      }
    }
  })
})

/* ═══════════════════════════════ 5. it never implies a payment ════════════════════════════════ */

describe('it promises nothing the pool does not pay', () => {
  /*
   * `pool/src/payouts.ts` derives `payoutsImplemented` and it is false on this estate. The standard
   * to match is `pool-web/src/components/notices.tsx`: present tense, no schedule, and ACCOMPANIED
   * BY NO NUMBER — "a zero reads as 'not yet, but soon' and the truth is 'not at all'".
   */
  it('carries the clause in every state that offers to mine, by default', () => {
    for (const key of ['signed-out', 'idle', 'mining', 'elsewhere']) {
      assert.ok(
        text(RENDERED[key] ?? '').includes(NOT_PAID_CLAUSE),
        `${key}: the not-paid clause is missing`,
      )
    }
  })

  it('drops the clause only when a caller can prove settlement exists', () => {
    for (const [key, props] of Object.entries(STATES)) {
      if (key === 'unavailable') continue
      const paid = text(render({ ...props, payoutsImplemented: true } as MiningControlProps))
      assert.ok(!paid.includes(NOT_PAID_CLAUSE), `${key}: the clause survives payoutsImplemented`)
    }
  })

  /*
   * The type is the real guard: there is no prop for an amount, a balance, a projection or a
   * currency, so a caller cannot pass one. This is the compile-time half of the assertion below.
   */
  it('will not compile a control that carries an amount', () => {
    // @ts-expect-error there is deliberately no earnings prop on any arm
    const bad: MiningControlProps = { phase: 'idle', onStart: () => {}, earned: '0.004 LTC' }
    assert.ok(bad)
  })

  it('names no currency and no earning, in any state, paid or not', () => {
    const WORDS = /\b(earn|earned|earnings|reward|rewards|payout|payouts|paid out|profit|revenue|income|balance|wallet|BTC|LTC|DOGE|USD)\b/i
    const MARKS = /[$€£₿]/
    for (const [key, props] of Object.entries(STATES)) {
      for (const paid of [false, true]) {
        const seen = text(render({ ...props, payoutsImplemented: paid } as MiningControlProps))
        // The clause itself says "nothing is paid out", which is the one legitimate occurrence.
        const own = seen.replace(NOT_PAID_CLAUSE, '')
        const word = WORDS.exec(own)
        assert.ok(!word, `${key} (paid=${paid}): the copy says "${word?.[0]}"`)
        assert.ok(!MARKS.test(own), `${key} (paid=${paid}): a currency mark appears`)
      }
    }
  })

  /*
   * The two numbers this control shows are HASHES PER SECOND and SHARES ACCEPTED. Both are work.
   * The assertion is that they are the only ones — a third figure appearing here would almost
   * certainly be a settlement number, because there is nothing else to count.
   */
  it('shows work and only work: the measured rate and the accepted shares', () => {
    const seen = text(RENDERED.mining ?? '')
    assert.ok(seen.includes('412 kH/s'), `the measured rate is not shown: ${seen}`)
    assert.ok(seen.includes('9 shares accepted'), `the accepted count is not shown: ${seen}`)
    assert.deepEqual(seen.replace(NOT_PAID_CLAUSE, '').match(/\d+(?:\.\d+)?/g), ['412', '412', '9'])
  })

  it('shows no figure at all in the states that have nothing to measure', () => {
    for (const key of ['unavailable', 'signed-out', 'idle', 'elsewhere']) {
      const own = text(RENDERED[key] ?? '')
        .replace(NOT_PAID_CLAUSE, '')
        .replace(REASON, '')
      assert.ok(!/\d/.test(own), `${key}: a number appears with nothing to derive it from: ${own}`)
    }
  })
})

/* ══════════════════ 5b. and it says the OTHER true thing about the other chain ════════════════ */

/**
 * EMBER, which IS credited — micro-org#362.
 *
 * The pool's clause and EMBER's clause are opposites and both are true, of different things. The
 * failing shape this section polices is the tempting one: a single sentence hedged enough to cover
 * both, which would either promise a credit the pool does not make or deny one the sweep does.
 *
 * The mechanism behind the EMBER clause is `hub-web/src/lib/embersweep.ts` and it is not
 * theoretical: it ran on mainnet from 2026-08-10, block 10,919 onward, sweeping 5.3929 EMBER a
 * block into the owner's own custodial deposit address.
 */
describe('it says what is true of EMBER, which is not what is true of the pool', () => {
  const EMBER_STATES: Record<string, MiningControlProps> = {
    idle: { phase: 'idle', onStart: () => {}, subject: 'ember' },
    mining: {
      phase: 'mining',
      onStop: () => {},
      readout: { hashrate: 412_318, accepted: 9 },
      subject: 'ember',
    },
    elsewhere: {
      phase: 'elsewhere',
      href: 'https://example.invalid/mine?chain=ember',
      hostSurfaceName: HOST_NAME,
      subject: 'ember',
      reason: EMBER_REASON,
    },
  }

  it('names EMBER and the network, and never the pool, in every state that can mine it', () => {
    for (const [key, props] of Object.entries(EMBER_STATES)) {
      const seen = text(render(props))
      assert.ok(seen.includes('EMBER'), `${key}: the chain being mined is not named`)
      assert.ok(
        !/\bpool\b/i.test(seen),
        `${key}: an EMBER state names the pool. EMBER does not go through it — ` +
          `\`pool/src/chains.ts\` refuses to run one for it: ${seen}`,
      )
    }
  })

  /*
   * THE ASSERTION THIS SECTION EXISTS FOR. `NOT_PAID_CLAUSE` says "nothing is paid out and there is
   * no mechanism by which it could be". Attached to an EMBER session that is sweeping to the
   * reader's own deposit address, that is not a cautious overstatement — it is false, and it is
   * false about the one thing the reader most needs to be right.
   */
  it('carries the credited clause and NEVER the not-paid one, for the two states that mine', () => {
    for (const key of ['idle', 'mining']) {
      const seen = text(render(EMBER_STATES[key] as MiningControlProps))
      assert.ok(
        seen.includes(EMBER_CREDITED_CLAUSE),
        `${key}: an EMBER session does not say where the blocks it finds go`,
      )
      assert.ok(
        !seen.includes(NOT_PAID_CLAUSE),
        `${key}: an EMBER session claims nothing is paid out. It is: the block is paid on chain ` +
          `to a key this tab holds and swept to the account's own deposit address`,
      )
    }
  })

  /*
   * `payoutsImplemented` is `GET /v1/pool` describing the POOL. An EMBER clause that appeared or
   * vanished with it would be reading one service's answer about another system's question — and it
   * is the mistake a reader of the code makes first, because every other clause here is gated on it.
   */
  it('does not let the pool’s payout flag rewrite either half of EMBER’s sentence', () => {
    for (const [key, props] of Object.entries(EMBER_STATES)) {
      const off = text(render({ ...props, payoutsImplemented: false } as MiningControlProps))
      const on = text(render({ ...props, payoutsImplemented: true } as MiningControlProps))
      assert.equal(off, on, `${key}: the pool's payout flag changed what an EMBER state says`)
      assert.ok(!on.includes(NOT_PAID_CLAUSE), `${key}: the pool clause reached an EMBER state`)
    }
  })

  /*
   * A pool session returns SHARES and an EMBER session finds BLOCKS. They are counted in the same
   * field because they are the same fact — work this browser did that the other side accepted — and
   * a control that called a block a share would be describing a fraction of a thing as a whole one.
   */
  it('counts blocks rather than shares, and still shows nothing but work', () => {
    const seen = text(render(EMBER_STATES.mining as MiningControlProps))
    assert.ok(seen.includes('412 kH/s'), `the measured rate is not shown: ${seen}`)
    assert.ok(seen.includes('9 blocks accepted'), `the accepted count is not shown: ${seen}`)
    assert.ok(!/\bshares?\b/i.test(seen), `an EMBER session calls its blocks shares: ${seen}`)
    assert.deepEqual(seen.replace(EMBER_CREDITED_CLAUSE, '').match(/\d+(?:\.\d+)?/g), ['412', '412', '9'])
  })

  it('puts no figure in the EMBER states that have nothing to measure', () => {
    for (const key of ['idle', 'elsewhere']) {
      const own = text(render(EMBER_STATES[key] as MiningControlProps))
        .replace(EMBER_CREDITED_CLAUSE, '')
        .replace(EMBER_REASON, '')
      assert.ok(!/\d/.test(own), `${key}: a number appears with nothing to derive it from: ${own}`)
    }
  })

  it('names no currency and no earning either, paid or not', () => {
    const WORDS = /\b(earn|earned|earnings|reward|rewards|payout|payouts|paid out|profit|revenue|income|balance|wallet|BTC|LTC|DOGE|USD)\b/i
    const MARKS = /[$€£₿]/
    for (const [key, props] of Object.entries(EMBER_STATES)) {
      for (const paid of [false, true]) {
        const seen = text(render({ ...props, payoutsImplemented: paid } as MiningControlProps))
        const word = WORDS.exec(seen)
        assert.ok(!word, `${key} (paid=${paid}): the copy says "${word?.[0]}"`)
        assert.ok(!MARKS.test(seen), `${key} (paid=${paid}): a currency mark appears`)
      }
    }
  })

  /*
   * The destination state, which Forge Hub now renders at its own mining page. It has to say WHY,
   * and it has to stop short of the promise: this is the one state in which a found block would NOT
   * reach the account, which is the entire reason the reader is being sent somewhere.
   */
  it('renders the reason on the destination, and refuses to promise a credit beside it', () => {
    const html = render(EMBER_STATES.elsewhere as MiningControlProps)
    const { tag, attrs } = control(html)
    assert.equal(tag, 'a', 'the destination is not an anchor')
    assert.match(attrs, /href="https:\/\/example\.invalid\/mine\?chain=ember"/)
    const seen = text(html)
    assert.ok(seen.includes(EMBER_REASON), `the reason is not rendered: ${seen}`)
    assert.ok(
      !seen.includes(EMBER_CREDITED_CLAUSE),
      'the destination state promises that blocks reach the account, in the one state where the ' +
        'reader is being sent away precisely because they would not',
    )
    assert.ok(!seen.includes(NOT_PAID_CLAUSE), `the pool clause reached an EMBER destination: ${seen}`)
  })

  /*
   * The safe default, proved rather than assumed. `subject` is optional on three arms; thirteen
   * surfaces and every existing call site omit it, and this is what says their copy did not move.
   */
  it('leaves every caller that names no subject exactly where it was', () => {
    for (const key of ['idle', 'mining', 'elsewhere']) {
      const props = STATES[key] as MiningControlProps
      assert.equal(
        text(render(props)),
        text(render({ ...props, subject: 'pool' } as MiningControlProps)),
        `${key}: omitting the subject is not the same as asking for the pool`,
      )
    }
  })

  it('will not compile a subject that is neither', () => {
    // @ts-expect-error there are two subjects and they are the two clauses. A third would be a
    // sentence nobody has written and a claim nobody has checked.
    const bad: MiningControlProps = { phase: 'idle', onStart: () => {}, subject: 'ltc' }
    assert.ok(bad)
  })
})

/* ═════════════════════════════════════ 6. the rate format ═════════════════════════════════════ */

describe('formatHashrate reads at the precision a person reads', () => {
  it('steps through SI and keeps three significant figures', () => {
    assert.equal(formatHashrate(412_318), '412 kH/s')
    assert.equal(formatHashrate(45_678), '45.7 kH/s')
    assert.equal(formatHashrate(1_500), '1.50 kH/s')
    assert.equal(formatHashrate(4_120_000), '4.12 MH/s')
  })

  /*
   * Below a kilohash the raw count is shown rather than "0.00 kH/s". That range is exactly where a
   * browser that has just started is, and rounding it to a zero would read as not working — the
   * same reason the honesty notice refuses to render a zero.
   */
  it('shows the raw count below 1 kH/s rather than rounding a working miner to zero', () => {
    assert.equal(formatHashrate(5), '5 H/s')
    assert.equal(formatHashrate(999), '999 H/s')
  })

  it('answers for a miner that has produced nothing, and for nonsense', () => {
    assert.equal(formatHashrate(0), '0 H/s')
    assert.equal(formatHashrate(-1), '0 H/s')
    assert.equal(formatHashrate(Number.NaN), '0 H/s')
    assert.equal(formatHashrate(Number.POSITIVE_INFINITY), '0 H/s')
  })
})

/* ══════════════════════════════ 7. the one-line adoption helper ═══════════════════════════════ */

describe('miningOnHub composes the destination once, from the registry', () => {
  it('names the surface the registry names, rather than a second name written here', () => {
    const props = miningOnHub('https://hub.example.invalid')
    assert.equal(props.phase, 'elsewhere')
    assert.equal(props.phase === 'elsewhere' && props.hostSurfaceName, surface('hub').name)
  })

  it('appends the one path, and does not double a trailing slash', () => {
    const a = miningOnHub('https://hub.example.invalid')
    const b = miningOnHub('https://hub.example.invalid/')
    assert.equal(a.phase === 'elsewhere' && a.href, `https://hub.example.invalid${HUB_MINE_PATH}`)
    assert.equal(b.phase === 'elsewhere' && b.href, `https://hub.example.invalid${HUB_MINE_PATH}`)
  })

  it('defaults to the honest answer about settlement', () => {
    assert.equal(miningOnHub('https://hub.example.invalid').payoutsImplemented, false)
    assert.equal(miningOnHub('https://hub.example.invalid', true).payoutsImplemented, true)
  })

  /*
   * One artefact serves localhost, a preview host and mainnet. A hostname compiled into this
   * package would be green in CI and wrong in production — the failure `no-build-time-config`
   * polices in every frontend — so the origin is an argument and this file proves it.
   */
  it('bakes in no hostname of its own', () => {
    const source = readFileSync(new URL('./mining.tsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    assert.ok(!/cloudsforge\.(online|localtest)/.test(source), 'an apex is baked into the module')
    assert.ok(!/https?:\/\//.test(source), 'an absolute URL is baked into the module')
  })
})

/* ═══════════════════════════════ 8. where it sits in the bar ══════════════════════════════════ */

describe('it sits beside the account, on every page that mounts the bar', () => {
  const bar = (mining?: MiningControlProps) =>
    renderToStaticMarkup(
      createElement(CloudsForgeBar, {
        current: 'market',
        account: { signedIn: true, handle: 'operator' },
        ...(mining === undefined ? {} : { mining }),
      }),
    )

  it('renders nothing extra when a surface has not adopted it', () => {
    assert.ok(!bar().includes('cf-mine'), 'the bar renders the control unasked')
  })

  /*
   * OPT-IN rather than defaulted, and this case is the record of why. This package is linked into
   * nineteen bundles whose suites assert on the bar's exact markup; a default would fail the CI of
   * every repository nobody is editing. A surface adopts it with one line when its own tests are
   * ready — `mining={miningOnHub(hosts().hub)}`.
   */
  it('renders the control when a surface passes one', () => {
    const html = bar(miningOnHub('https://hub.example.invalid'))
    assert.ok(html.includes('cf-mine'), 'the control is missing')
    assert.ok(html.includes(`https://hub.example.invalid${HUB_MINE_PATH}`))
  })

  /*
   * BESIDE THE ACCOUNT is the whole of the change. The owner's complaint was that starting a miner
   * is "hidden deep in mining page"; a control that lands in a different place on each surface is
   * hidden again. This pins the order rather than trusting the JSX to stay in it.
   */
  it('puts it between the surface’s own right slot and the account menu', () => {
    const html = bar(miningOnHub('https://hub.example.invalid'))
    const mine = html.indexOf('cf-mine')
    const account = html.indexOf('cf-account')
    const spacer = html.indexOf('cf-bar__spacer')
    assert.ok(spacer >= 0 && mine > spacer, 'the control is on the left of the bar')
    assert.ok(account >= 0 && mine < account, 'the control is not before the account menu')
  })

  it('is inside the bar’s own row, not floated somewhere else', () => {
    const html = bar(miningOnHub('https://hub.example.invalid'))
    const inner = /<div class="cf-bar__inner">([\s\S]*)<\/div>/.exec(html)?.[1] ?? ''
    assert.ok(inner.includes('cf-mine'), 'the control escaped the bar row')
  })
})

/* ═════════════════════════ the stylesheet paints what it renders ══════════════════════════════ */

describe('every class it emits is one ui.css paints', () => {
  /*
   * A class name that exists only in the TSX is a rule that never applies, and it looks exactly
   * like a rule that does until somebody opens the page.
   */
  it('names no class the stylesheet does not carry', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const emitted = new Set<string>()
    for (const html of Object.values(RENDERED)) {
      for (const m of html.matchAll(/class="([^"]*)"/g)) {
        for (const cls of (m[1] ?? '').split(/\s+/)) if (cls) emitted.add(cls)
      }
    }
    assert.ok(emitted.size >= 6, `only ${emitted.size} classes emitted — the scan found nothing`)
    for (const cls of emitted) {
      assert.ok(css.includes(`.${cls}`), `ui.css does not paint .${cls}`)
    }
  })

  /*
   * Ember has exactly three uses, listed at the head of `ui.css`, and they are the COMPANY's
   * colour rather than a product accent. This control is about to appear on every page of every
   * surface, which makes it the single most likely place for a fourth use to be added by somebody
   * reaching for emphasis — so the rules that paint it are checked for the token by name.
   */
  it('spends no ember on the most-repeated control in the estate', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    const rules = [...css.matchAll(/(^|\})([^{}]*\.cf-mine[^{}]*)\{([^{}]*)\}/g)]
    assert.ok(rules.length >= 5, `only ${rules.length} .cf-mine rules found — the scan missed them`)
    for (const rule of rules) {
      assert.ok(!(rule[3] ?? '').includes('--cf-ember'), `ember appears in: ${rule[2]?.trim()}`)
    }
  })
})
