/**
 * Analytics consent, and the gate that stands in front of Google Analytics.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE RULE: NO CONSENT, NO SCRIPT, NO COOKIE.
 *
 * The tag Google hands you is this:
 *
 *     <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>
 *     <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
 *             gtag('js',new Date());gtag('config','G-XXXXXXX');</script>
 *
 * Pasted into a head, that fetches a third-party script and sets `_ga` and `_ga_<id>` — first-party
 * cookies, but non-essential ones — BEFORE any banner has been drawn, let alone answered. Under
 * the ePrivacy Directive Art. 5(3) as implemented across the EU, storing or reading information on
 * a user's terminal equipment for anything other than a strictly necessary purpose requires prior
 * consent; analytics is settled case law and regulator guidance as NOT strictly necessary. So the
 * stock snippet is a violation on load, and it is a violation that a banner underneath it does not
 * cure — the cookie is already set. This estate is separately under GDPR review (issues #33, #161,
 * #162 in cloudsforge-online/micro-org) and custodies other people's money, which makes "we will
 * tidy the analytics later" the wrong order to do things in.
 *
 * Hence: the script tag is NEVER in any `index.html`. It does not exist until {@link grantConsent}
 * injects it, and {@link grantConsent} is only ever called from a click on the Accept button.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * FOUR THINGS THAT MAKE THIS CONSENT RATHER THAN A NOTICE
 *
 *   1. **Reject is as easy as Accept.** One click, one keystroke, same size, same colour, same
 *      class — `.cf-consent__choice` styles both with one rule and there is no modifier to make
 *      one louder. A banner offering only "Accept", or offering "Accept" beside a grey "manage
 *      preferences" link, is not freely given consent under Art. 4(11); the CNIL and the EDPB have
 *      both said so in terms, and both have fined for it.
 *   2. **Nothing is set before the answer.** Not even the consent record: see the note on
 *      {@link CONSENT_STORAGE_KEY} for where the decision is kept, why it is kept on the
 *      registrable domain so one answer covers every surface, and why storing that record is legal
 *      without consent while the analytics cookie it gates is not.
 *   3. **The decision is revisitable.** {@link clearConsent} puts the banner back, and
 *      {@link revokeConsent} additionally deletes the cookies GA already set. Consent that cannot
 *      be withdrawn as easily as it was given is not consent (Art. 7(3)).
 *   4. **Consent Mode defaults are denied before anything runs.** The `dataLayer` is primed with
 *      `gtag('consent','default',{analytics_storage:'denied'})` — a plain array push, no network,
 *      no cookie — so that in the window between the script arriving and the config running there
 *      is no state in which storage is permitted by default.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHERE THE MEASUREMENT ID COMES FROM
 *
 * A `<meta name="cf-analytics">` in the shell, read at runtime — the same mechanism the estate
 * already uses for `<meta name="cf-release">`, and for the same reason. It cannot be a `VITE_`
 * variable: `no-build-time-config.test.ts` greps for those and fails the build, because an
 * artefact with an environment frozen into it is not the artefact that passed CI. It is not
 * hard-coded in a component either, which is what the brief asked to avoid and which would put the
 * same string in seventeen bundles.
 *
 * An absent or empty meta tag means analytics is simply off, and that is a supported mode rather
 * than a misconfiguration — it is what a local `pnpm dev` should do.
 */

/** The two answers. There is no third: "not yet asked" is `null`. */
export type ConsentDecision = 'granted' | 'denied'

/**
 * Where the decision is kept.
 *
 * BOTH a cookie on the registrable domain AND `localStorage`, and the cookie is the one that
 * matters. This used to be `localStorage` alone, with a note here saying a cookie "would
 * additionally be sent on every request to the origin, which is a transfer nobody needs". That
 * reasoning was sound about one surface and wrong about this estate, because `localStorage` is
 * scoped to an ORIGIN and every surface here is a different subdomain. A reader who accepted on
 * `cloudsforge.online` was asked again on `hub.`, again on `explorer.`, again on `developers.` and
 * again on `status.` — seventeen surfaces, seventeen banners, one decision they had already made.
 * Reported by the owner after answering it on subdomain after subdomain.
 *
 * A cookie set on the registrable domain (`.cloudsforge.online`) is visible to every subdomain, so
 * one answer covers the estate. That is the only shared client-side store a browser offers without
 * a network round-trip and without a third-party frame, and paying ~30 bytes on each request to
 * this domain is a straightforwardly better trade than asking the same question seventeen times.
 *
 * The legal position does not change with the mechanism. Art. 5(3) exempts storage "strictly
 * necessary for the provision of a service explicitly requested by the subscriber", and a record
 * of the reader's own consent choice is the textbook example regulators give of that exemption —
 * it is exempt because without it the banner cannot stop asking, not because of where it is kept.
 * That is why storing the RECORD needs no consent while the analytics cookie it gates does.
 *
 * `localStorage` is still written, and still read as a fallback. Two reasons, both real: it keeps
 * every reader who already answered under the old scheme answered, and it is the store that still
 * works when a reader has blocked cookies entirely — in which case they are asked once per surface
 * rather than once per page, which is the honest degradation.
 */
export const CONSENT_STORAGE_KEY = 'cf.consent.analytics'

/**
 * The cookie name. Deliberately not the `localStorage` key: a dot is legal in a cookie name but is
 * asking for trouble in the parsers this gets read by, and the two stores are read separately
 * anyway.
 */
export const CONSENT_COOKIE_NAME = 'cf_consent_analytics'

/**
 * How long a recorded answer lasts before the reader is asked again: six months.
 *
 * The CNIL's guidance is that a consent decision should not be treated as valid indefinitely and
 * puts six months forward as the reasonable period, and the same period applies to a REFUSAL —
 * re-asking a reader who said no sooner than that is nagging, which is its own compliance problem.
 * So one constant, used for both answers.
 */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182

/** The meta tag the measurement ID is read from. */
export const ANALYTICS_META_NAME = 'cf-analytics'

/** Fired on `window` whenever the decision changes, so open tabs and other components follow. */
export const CONSENT_EVENT = 'cf:consent'

interface ConsentGlobals {
  dataLayer?: unknown[]
  __cfAnalyticsLoaded?: string
}

function globalsOf(): (Window & ConsentGlobals) | null {
  return typeof window === 'undefined' ? null : (window as Window & ConsentGlobals)
}

/* ─────────────────────────── the shared cookie ─────────────────────────── */

/**
 * The domains a cookie could be set on, from the WIDEST that might work inward.
 *
 * For `hub-testnet.cloudsforge.online` that is `.cloudsforge.online`, then
 * `.hub-testnet.cloudsforge.online`, and finally `''` — no domain attribute at all, which scopes
 * the cookie to exactly this host and is the only correct answer for `localhost` and for a bare IP.
 *
 * The widest candidate is the last two labels, NOT every parent up the tree, because a browser
 * silently discards a cookie whose `domain` is a public suffix — `domain=.online` sets nothing, and
 * so does `domain=.co.uk`. Walking from the widest inward and stopping at the first one that
 * actually reads back is the standard way to find the registrable domain without shipping a copy of
 * the Public Suffix List, and it handles `.co.uk` correctly for free: `.example.co.uk` is rejected
 * as a public suffix, so the walk falls through to the host-only cookie rather than to nothing.
 *
 * Two labels is enough for the widest candidate here and everywhere it is likely to run. If this
 * estate ever moves under a multi-label suffix, the walk degrades to a per-host cookie — the old
 * behaviour — rather than to no cookie at all.
 */
export function consentCookieDomains(hostname: string): readonly string[] {
  if (hostname === '' || /^\[?[0-9a-f:.]+\]?$/i.test(hostname)) return ['']
  const labels = hostname.split('.')
  if (labels.length < 2) return ['']
  const candidates = [`.${labels.slice(-2).join('.')}`]
  if (labels.length > 2) candidates.push(`.${hostname}`)
  candidates.push('')
  return candidates
}

/** Read one cookie by name. `null` when it is absent, unreadable, or the document has no cookies. */
function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  let jar: string
  try {
    jar = document.cookie
  } catch {
    return null
  }
  for (const raw of jar.split(';')) {
    const eq = raw.indexOf('=')
    if (eq < 0) continue
    if (raw.slice(0, eq).trim() !== name) continue
    try {
      return decodeURIComponent(raw.slice(eq + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

/**
 * Write the consent cookie on the widest domain the browser will accept, and confirm it took.
 *
 * The confirmation is the point. `document.cookie = …` reports nothing: a rejected `domain` is
 * discarded in silence, and a "shared" consent that was silently scoped to one host is exactly the
 * defect this is here to fix. So each candidate is written and then read back, and the first one
 * that survives is the one kept.
 *
 * `SameSite=Lax` because this record is never needed on a cross-site POST, and `Secure` on https
 * only — a `Secure` cookie is discarded outright over http, which would break `pnpm dev`.
 */
function writeConsentCookie(decision: ConsentDecision): void {
  const w = globalsOf()
  if (!w || typeof document === 'undefined') return
  const secure = w.location.protocol === 'https:' ? '; Secure' : ''
  for (const domain of consentCookieDomains(w.location.hostname)) {
    try {
      document.cookie =
        `${CONSENT_COOKIE_NAME}=${decision}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}` +
        (domain === '' ? '' : `; Domain=${domain}`)
    } catch {
      return
    }
    if (readCookie(CONSENT_COOKIE_NAME) === decision) return
  }
}

/** Expire the consent cookie on every scope it could have been written to. */
function deleteConsentCookie(): void {
  const w = globalsOf()
  if (!w || typeof document === 'undefined') return
  for (const domain of consentCookieDomains(w.location.hostname)) {
    try {
      document.cookie =
        `${CONSENT_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax` +
        (domain === '' ? '' : `; Domain=${domain}`)
    } catch {
      return
    }
  }
}

/* ─────────────────────────── reading and writing ─────────────────────────── */

/**
 * The decision, or `null` when the reader has not been asked yet.
 *
 * The cookie is consulted first, because it is the store that spans the estate: a reader who
 * answered on any surface has already answered on this one. `localStorage` is the fallback, which
 * is what keeps readers who answered before the cookie existed from being asked again.
 *
 * Every storage access in this module is wrapped: `localStorage` throws rather than returning
 * undefined in a Safari private window and under a `SecurityError` from a sandboxed frame, and a
 * consent banner that crashes the page it is meant to protect is worse than no banner. An
 * unreadable store reads as "not yet asked", which is the safe answer — it asks again rather than
 * assuming a grant.
 */
export function readConsent(): ConsentDecision | null {
  const cookie = readCookie(CONSENT_COOKIE_NAME)
  if (cookie === 'granted' || cookie === 'denied') return cookie
  try {
    const raw = globalsOf()?.localStorage.getItem(CONSENT_STORAGE_KEY)
    return raw === 'granted' || raw === 'denied' ? raw : null
  } catch {
    return null
  }
}

/** Record a decision and tell the page. Does not itself load or unload anything. */
export function writeConsent(decision: ConsentDecision): void {
  const w = globalsOf()
  if (!w) return
  writeConsentCookie(decision)
  try {
    w.localStorage.setItem(CONSENT_STORAGE_KEY, decision)
  } catch {
    // A reader who has blocked storage still gets the banner's behaviour for this page view; they
    // will be asked again next time, which is the honest outcome rather than a silent grant.
  }
  w.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: decision }))
}

/** Forget the decision, so the banner asks again. Does not delete analytics cookies. */
export function clearConsent(): void {
  const w = globalsOf()
  if (!w) return
  deleteConsentCookie()
  try {
    w.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    /* see writeConsent */
  }
  w.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }))
}

/** Subscribe to changes. Returns the unsubscribe function. */
export function onConsentChange(listener: (decision: ConsentDecision | null) => void): () => void {
  const w = globalsOf()
  if (!w) return () => {}
  const handler = (e: Event): void => {
    listener((e as CustomEvent<ConsentDecision | null>).detail ?? null)
  }
  // `storage` as well as the custom event: a reader with two tabs open who answers in one should
  // not be asked again in the other.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === CONSENT_STORAGE_KEY) listener(readConsent())
  }
  w.addEventListener(CONSENT_EVENT, handler)
  w.addEventListener('storage', onStorage)
  return () => {
    w.removeEventListener(CONSENT_EVENT, handler)
    w.removeEventListener('storage', onStorage)
  }
}

/* ─────────────────────────────── the measurement ID ─────────────────────────────── */

/**
 * The measurement ID from the shell, or `null`.
 *
 * The shape is checked rather than trusted. A GA4 measurement ID is `G-` followed by an
 * alphanumeric string; anything else is a placeholder somebody forgot to substitute, and injecting
 * a script URL built from an unvalidated attribute is how a template variable becomes an
 * open redirect in a `src`.
 */
export function analyticsId(): string | null {
  if (typeof document === 'undefined') return null
  const content = document
    .querySelector(`meta[name="${ANALYTICS_META_NAME}"]`)
    ?.getAttribute('content')
    ?.trim()
  if (content === undefined || content === '') return null
  return /^G-[A-Z0-9]{4,20}$/i.test(content) ? content : null
}

/**
 * Whether this origin should report at all.
 *
 * A local stack, a `.local` hostname and a preview deployment are development traffic. Reporting
 * them pollutes the property with sessions nobody made and, more to the point, means a developer's
 * browser is asked for consent to something that should never have been offered. The check is on
 * the hostname rather than on a build flag, for the same reason every host in this estate is.
 */
export function analyticsAllowedHere(): boolean {
  const host = globalsOf()?.location.hostname ?? ''
  if (host === '') return false
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
  if (host.endsWith('.local') || host.endsWith('.localtest.me')) return false
  return true
}

/* ─────────────────────────────── the gate itself ─────────────────────────────── */

/**
 * The `gtag` shim, reproduced rather than approximated.
 *
 * Google's own snippet is `function gtag(){dataLayer.push(arguments)}` — it pushes the ARGUMENTS
 * OBJECT, not an array, and that is load-bearing rather than incidental: the tag reads each queued
 * entry as an arguments object and an array of the same values is not accepted in its place. So
 * this is a `function` expression using `arguments`, which is exactly the thing a rest parameter
 * would tidy away and break.
 */
const gtag: (...args: readonly unknown[]) => void = function gtagShim(): void {
  const w = globalsOf()
  if (!w) return
  w.dataLayer = w.dataLayer ?? []
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments)
}

/**
 * Prime Consent Mode with everything DENIED, before any tag exists.
 *
 * No network request, no cookie, no script — this pushes two entries onto a plain array. Call it
 * once on boot, unconditionally. Its job is to make the denied state the one that is already
 * present if a tag ever does arrive, rather than a state that has to be raced into place.
 */
export function initConsentDefaults(): void {
  if (!globalsOf()) return
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted', // the one category that IS strictly necessary
    wait_for_update: 500,
  })
  gtag('set', 'url_passthrough', false)
  // IP anonymisation is on by default in GA4 and cannot be switched off, so there is nothing to
  // set for it here. Recorded because its absence otherwise reads like an omission.
}

/**
 * Load Google Analytics. Called from exactly one place: the Accept button.
 *
 * Idempotent — a second call after the script is on the page updates consent and returns, which is
 * what a reader who accepts, revokes and accepts again produces.
 */
export function grantConsent(id: string | null = analyticsId()): void {
  writeConsent('granted')
  const w = globalsOf()
  if (!w || id === null || !analyticsAllowedHere()) return

  gtag('consent', 'update', { analytics_storage: 'granted' })

  if (w.__cfAnalyticsLoaded === id) return
  w.__cfAnalyticsLoaded = id

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(script)

  gtag('js', new Date())
  // `anonymize_ip` is a no-op on GA4 and is not set. `allow_google_signals` false is not: it stops
  // the advertising features that would turn an analytics grant into an advertising one, which is
  // a purpose this banner does not ask about and therefore must not enable.
  gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false })
}

/**
 * Refuse, or withdraw a previous grant.
 *
 * Withdrawal has to do more than record a `no`: a script already on the page cannot be unloaded,
 * so the cookies it set are deleted and Consent Mode is told to stop. GA writes `_ga` and
 * `_ga_<container>` on the registrable domain, which is why each is expired against both the exact
 * hostname and the dot-prefixed parent — a delete that names only one of those leaves the other
 * one live, which is the classic reason a "reject" button does not actually reject.
 */
export function denyConsent(): void {
  writeConsent('denied')
  const w = globalsOf()
  if (!w) return
  gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  })
  deleteAnalyticsCookies()
}

/** Withdraw consent AND ask again on the next page view. */
export function revokeConsent(): void {
  denyConsent()
  clearConsent()
}

/** Expire every cookie Google Analytics is known to set, on every scope it may have set it on. */
export function deleteAnalyticsCookies(): void {
  if (typeof document === 'undefined') return
  const host = window.location.hostname
  const labels = host.split('.')
  const domains = ['']
  for (let i = 0; i < labels.length - 1; i += 1) domains.push(`; domain=.${labels.slice(i).join('.')}`)

  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim() ?? ''
    if (!/^(_ga|_gid|_gat)/.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`
    }
  }
}

/**
 * The whole gate, for a surface that just wants it to be right.
 *
 * Call once on boot, before React mounts. It primes the denied defaults and, if the reader has
 * ALREADY granted on a previous visit, re-loads the tag — which is the branch that makes the
 * decision persistent rather than per-page. It never loads anything on a first visit, because on a
 * first visit `readConsent()` is `null` and `null` is not `'granted'`.
 */
export function initAnalytics(): void {
  if (!globalsOf()) return
  initConsentDefaults()
  if (readConsent() === 'granted') grantConsent()
}
