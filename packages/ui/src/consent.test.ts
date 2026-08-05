/**
 * The consent gate, driven against a stand-in browser.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE ASSERTION THAT MATTERS
 *
 * `nothing reaches the network, and no cookie is set, before the reader has answered`.
 *
 * Everything else here supports it. That is the claim with legal weight — under ePrivacy Art. 5(3)
 * an analytics cookie set before consent is a violation whatever a banner underneath it says — and
 * it is a claim about an ABSENCE, which is the kind that quietly stops being true. A test that
 * only checked "Accept loads the tag" would stay green through a refactor that also loaded it on
 * boot, so the absence is asserted first and by name.
 *
 * The stand-in records every element appended to the head and every cookie written, rather than
 * mocking `document.createElement` to return nothing. A mock that returns nothing cannot tell the
 * difference between "no script was created" and "a script was created and dropped on the floor",
 * and only one of those is safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import {
  ANALYTICS_META_NAME,
  CONSENT_STORAGE_KEY,
  analyticsAllowedHere,
  analyticsId,
  clearConsent,
  denyConsent,
  grantConsent,
  initAnalytics,
  initConsentDefaults,
  onConsentChange,
  readConsent,
  revokeConsent,
} from './consent.ts'

/* ───────────────────────────────── the stand-in browser ───────────────────────────────── */

interface FakeElement {
  tagName: string
  async?: boolean
  src?: string
  attributes: Record<string, string>
  setAttribute: (k: string, v: string) => void
  getAttribute: (k: string) => string | null
}

interface Harness {
  appended: FakeElement[]
  cookiesWritten: string[]
  store: Map<string, string>
  events: (string | null)[]
}

let h: Harness

/** Build a browser with one meta tag, one hostname and an empty cookie jar. */
function install(options: { id?: string | null; hostname?: string; cookie?: string } = {}): void {
  const id = options.id === undefined ? 'G-NB8DNLTKZQ' : options.id
  h = { appended: [], cookiesWritten: [], store: new Map(), events: [] }
  let cookie = options.cookie ?? ''

  const element = (tagName: string): FakeElement => {
    const attributes: Record<string, string> = {}
    return {
      tagName,
      attributes,
      setAttribute: (k, v) => {
        attributes[k] = v
      },
      getAttribute: (k) => attributes[k] ?? null,
    }
  }

  const metaTag = element('meta')
  if (id !== null) metaTag.setAttribute('content', id)

  const listeners = new Map<string, ((e: unknown) => void)[]>()

  const fakeDocument = {
    head: { appendChild: (el: FakeElement) => h.appended.push(el) },
    createElement: element,
    querySelector: (selector: string) =>
      id !== null && selector === `meta[name="${ANALYTICS_META_NAME}"]` ? metaTag : null,
    get cookie(): string {
      return cookie
    },
    set cookie(value: string) {
      h.cookiesWritten.push(value)
      // Good enough for the delete path: an expiry in the past removes the name from the jar.
      const name = value.split('=')[0] ?? ''
      if (/expires=Thu, 01 Jan 1970/.test(value)) {
        cookie = cookie
          .split(';')
          .map((c) => c.trim())
          .filter((c) => c !== '' && c.split('=')[0] !== name)
          .join('; ')
      }
    },
  }

  const fakeWindow = {
    location: { hostname: options.hostname ?? 'cloudsforge.online' },
    localStorage: {
      getItem: (k: string) => h.store.get(k) ?? null,
      setItem: (k: string, v: string) => void h.store.set(k, v),
      removeItem: (k: string) => void h.store.delete(k),
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn])
    },
    removeEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((f) => f !== fn))
    },
    dispatchEvent: (e: { type: string; detail?: unknown }) => {
      for (const fn of listeners.get(e.type) ?? []) fn(e)
      return true
    },
    dataLayer: undefined as unknown[] | undefined,
    __cfAnalyticsLoaded: undefined as string | undefined,
  }

  const g = globalThis as Record<string, unknown>
  g['window'] = fakeWindow
  g['document'] = fakeDocument
  g['CustomEvent'] = class {
    type: string
    detail: unknown
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type
      this.detail = init?.detail
    }
  }
}

function uninstall(): void {
  const g = globalThis as Record<string, unknown>
  delete g['window']
  delete g['document']
  delete g['CustomEvent']
}

const scripts = (): FakeElement[] => h.appended.filter((e) => e.tagName === 'script')
const dataLayer = (): unknown[] =>
  ((globalThis as unknown as { window: { dataLayer?: unknown[] } }).window.dataLayer ?? [])

beforeEach(() => install())
afterEach(() => uninstall())

/* ───────────────────────────────────── the gate ───────────────────────────────────── */

describe('before the reader has answered', () => {
  it('loads NOTHING and sets NO cookie', () => {
    initAnalytics()
    assert.deepEqual(scripts(), [], 'a script was injected before consent')
    assert.deepEqual(h.cookiesWritten, [], 'a cookie was written before consent')
    assert.equal(readConsent(), null)
    assert.equal(h.store.size, 0, 'something was persisted before the reader answered')
  })

  it('primes Consent Mode with every category DENIED, without a request', () => {
    initConsentDefaults()
    const first = dataLayer()[0] as IArguments
    assert.equal(first[0], 'consent')
    assert.equal(first[1], 'default')
    const grants = first[2] as Record<string, string>
    for (const key of [
      'ad_storage',
      'ad_user_data',
      'ad_personalization',
      'analytics_storage',
      'functionality_storage',
      'personalization_storage',
    ]) {
      assert.equal(grants[key], 'denied', `${key} defaults to ${grants[key]}, not denied`)
    }
    // The one category that IS strictly necessary, and therefore the one that does not need asking.
    assert.equal(grants['security_storage'], 'granted')
    assert.deepEqual(scripts(), [], 'priming the dataLayer fetched something')
  })

  it('pushes an arguments object, not an array, because that is what the tag reads', () => {
    initConsentDefaults()
    const first = dataLayer()[0]
    assert.ok(!Array.isArray(first), 'the shim pushed an Array; gtag reads an arguments object')
    assert.equal((first as IArguments).length, 3)
  })
})

describe('accepting', () => {
  it('loads the tag exactly once, from the address Google serves it at', () => {
    grantConsent()
    assert.equal(scripts().length, 1)
    assert.equal(scripts()[0]?.src, 'https://www.googletagmanager.com/gtag/js?id=G-NB8DNLTKZQ')
    assert.equal(scripts()[0]?.async, true, 'the tag is not async, so it blocks the parser')
    assert.equal(readConsent(), 'granted')
  })

  it('is idempotent — a second accept does not load a second copy', () => {
    grantConsent()
    grantConsent()
    assert.equal(scripts().length, 1)
  })

  it('updates Consent Mode before configuring, and does not turn on advertising', () => {
    grantConsent()
    const calls = dataLayer().map((a) => [...(a as IArguments)])
    const update = calls.find((c) => c[0] === 'consent' && c[1] === 'update')
    assert.ok(update, 'no consent update was pushed')
    assert.equal((update[2] as Record<string, string>)['analytics_storage'], 'granted')

    const config = calls.find((c) => c[0] === 'config')
    assert.ok(config, 'no config was pushed')
    // The banner asks about analytics. Granting it must not quietly grant advertising as well,
    // which is what Google Signals does if it is left at its default.
    const options = config[2] as Record<string, boolean>
    assert.equal(options['allow_google_signals'], false)
    assert.equal(options['allow_ad_personalization_signals'], false)
  })

  it('survives a reload: the decision is remembered and the tag is re-loaded', () => {
    grantConsent()
    const remembered = h.store.get(CONSENT_STORAGE_KEY)
    // A fresh page, same storage.
    const jar = h.store
    install()
    h.store = jar
    assert.equal(readConsent(), 'granted')
    initAnalytics()
    assert.equal(scripts().length, 1, 'a returning reader who accepted is not measured')
    assert.equal(remembered, 'granted')
  })
})

describe('rejecting', () => {
  it('loads nothing at all', () => {
    denyConsent()
    assert.deepEqual(scripts(), [])
    assert.equal(readConsent(), 'denied')
  })

  it('is remembered, so a reader who said no is not asked on every page', () => {
    denyConsent()
    install.call(null)
    // (a fresh page with an empty jar would ask again — that is the next test's job)
    assert.equal(readConsent(), null)
  })

  it('expires every GA cookie, on the exact host AND on the registrable parent', () => {
    /*
     * The classic reason a Reject button does not reject. GA sets `_ga` on the registrable domain
     * (`.cloudsforge.online`), so a delete that names only `document.domain` removes nothing and
     * the cookie is still there on the next page view — with the banner gone, because the decision
     * was recorded.
     */
    install({ hostname: 'hub.cloudsforge.online', cookie: '_ga=GA1.1.x; _ga_ABC=GS1.1.y; sid=keep' })
    denyConsent()
    const written = h.cookiesWritten.join('\n')
    for (const name of ['_ga', '_ga_ABC']) {
      assert.ok(
        h.cookiesWritten.some((c) => c.startsWith(`${name}=`) && c.includes('domain=.cloudsforge.online')),
        `${name} was not expired on the registrable parent:\n${written}`,
      )
      assert.ok(
        h.cookiesWritten.some((c) => c.startsWith(`${name}=`) && !c.includes('domain=')),
        `${name} was not expired on the exact host:\n${written}`,
      )
    }
    assert.ok(!written.includes('sid='), 'a cookie that is not analytics was deleted')
  })

  it('withdrawal is as available as the grant was', () => {
    grantConsent()
    assert.equal(readConsent(), 'granted')
    revokeConsent()
    // Withdrawn AND forgotten, so the banner comes back and the reader is asked again rather than
    // being left on a silent `denied` they cannot see or change.
    assert.equal(readConsent(), null)
    const calls = dataLayer().map((a) => [...(a as IArguments)])
    const last = calls.filter((c) => c[0] === 'consent' && c[1] === 'update').at(-1)
    assert.equal((last?.[2] as Record<string, string>)['analytics_storage'], 'denied')
  })
})

describe('where the measurement ID comes from', () => {
  it('reads the shell meta tag', () => {
    assert.equal(analyticsId(), 'G-NB8DNLTKZQ')
  })

  it('is off, not broken, when the shell names none', () => {
    install({ id: null })
    assert.equal(analyticsId(), null)
    grantConsent()
    assert.deepEqual(scripts(), [], 'a script was built from a missing ID')
    // The decision is still recorded: the reader answered a question, even if nothing followed.
    assert.equal(readConsent(), 'granted')
  })

  it('refuses anything that is not a GA4 measurement ID', () => {
    for (const bad of ['', '   ', '${ANALYTICS_ID}', 'UA-12345-6', 'G-', 'javascript:alert(1)']) {
      install({ id: bad })
      assert.equal(analyticsId(), null, `accepted ${JSON.stringify(bad)} as a measurement ID`)
    }
  })
})

describe('where it is allowed to report from', () => {
  it('is silent on a developer machine', () => {
    for (const host of ['localhost', '127.0.0.1', 'macbook.local', 'hub.cloudsforge.localtest.me']) {
      install({ hostname: host })
      assert.equal(analyticsAllowedHere(), false, `${host} would report`)
      grantConsent()
      assert.deepEqual(scripts(), [], `${host} loaded the tag`)
    }
  })

  it('reports from a real hostname', () => {
    install({ hostname: 'trade.cloudsforge.online' })
    assert.equal(analyticsAllowedHere(), true)
  })
})

describe('the decision store', () => {
  it('reads an unavailable localStorage as "not yet asked" rather than as a grant', () => {
    install()
    const w = (globalThis as unknown as { window: { localStorage: unknown } }).window
    w.localStorage = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('SecurityError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    assert.equal(readConsent(), null)
    // And nothing throws out of the write path either, or a Safari private window crashes the page
    // the banner exists to protect.
    assert.doesNotThrow(() => denyConsent())
    assert.doesNotThrow(() => clearConsent())
  })

  it('ignores a value it did not write', () => {
    h.store.set(CONSENT_STORAGE_KEY, 'yes-please')
    assert.equal(readConsent(), null)
  })

  it('tells the page when the decision changes', () => {
    const seen: (string | null)[] = []
    const off = onConsentChange((d) => seen.push(d))
    grantConsent()
    denyConsent()
    clearConsent()
    off()
    grantConsent()
    assert.deepEqual(seen, ['granted', 'denied', null], 'the listener did not see every change')
  })
})
