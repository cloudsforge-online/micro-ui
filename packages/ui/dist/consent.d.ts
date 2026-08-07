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
export type ConsentDecision = 'granted' | 'denied';
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
export declare const CONSENT_STORAGE_KEY = "cf.consent.analytics";
/**
 * The cookie name. Deliberately not the `localStorage` key: a dot is legal in a cookie name but is
 * asking for trouble in the parsers this gets read by, and the two stores are read separately
 * anyway.
 */
export declare const CONSENT_COOKIE_NAME = "cf_consent_analytics";
/**
 * How long a recorded answer lasts before the reader is asked again: six months.
 *
 * The CNIL's guidance is that a consent decision should not be treated as valid indefinitely and
 * puts six months forward as the reasonable period, and the same period applies to a REFUSAL —
 * re-asking a reader who said no sooner than that is nagging, which is its own compliance problem.
 * So one constant, used for both answers.
 */
export declare const CONSENT_MAX_AGE_SECONDS: number;
/** The meta tag the measurement ID is read from. */
export declare const ANALYTICS_META_NAME = "cf-analytics";
/** Fired on `window` whenever the decision changes, so open tabs and other components follow. */
export declare const CONSENT_EVENT = "cf:consent";
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
export declare function consentCookieDomains(hostname: string): readonly string[];
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
export declare function readConsent(): ConsentDecision | null;
/** Record a decision and tell the page. Does not itself load or unload anything. */
export declare function writeConsent(decision: ConsentDecision): void;
/** Forget the decision, so the banner asks again. Does not delete analytics cookies. */
export declare function clearConsent(): void;
/** Subscribe to changes. Returns the unsubscribe function. */
export declare function onConsentChange(listener: (decision: ConsentDecision | null) => void): () => void;
/**
 * The measurement ID from the shell, or `null`.
 *
 * The shape is checked rather than trusted. A GA4 measurement ID is `G-` followed by an
 * alphanumeric string; anything else is a placeholder somebody forgot to substitute, and injecting
 * a script URL built from an unvalidated attribute is how a template variable becomes an
 * open redirect in a `src`.
 */
export declare function analyticsId(): string | null;
/**
 * Whether this origin should report at all.
 *
 * A local stack, a `.local` hostname and a preview deployment are development traffic. Reporting
 * them pollutes the property with sessions nobody made and, more to the point, means a developer's
 * browser is asked for consent to something that should never have been offered. The check is on
 * the hostname rather than on a build flag, for the same reason every host in this estate is.
 */
export declare function analyticsAllowedHere(): boolean;
/**
 * Prime Consent Mode with everything DENIED, before any tag exists.
 *
 * No network request, no cookie, no script — this pushes two entries onto a plain array. Call it
 * once on boot, unconditionally. Its job is to make the denied state the one that is already
 * present if a tag ever does arrive, rather than a state that has to be raced into place.
 */
export declare function initConsentDefaults(): void;
/**
 * Load Google Analytics. Called from exactly one place: the Accept button.
 *
 * Idempotent — a second call after the script is on the page updates consent and returns, which is
 * what a reader who accepts, revokes and accepts again produces.
 */
export declare function grantConsent(id?: string | null): void;
/**
 * Refuse, or withdraw a previous grant.
 *
 * Withdrawal has to do more than record a `no`: a script already on the page cannot be unloaded,
 * so the cookies it set are deleted and Consent Mode is told to stop. GA writes `_ga` and
 * `_ga_<container>` on the registrable domain, which is why each is expired against both the exact
 * hostname and the dot-prefixed parent — a delete that names only one of those leaves the other
 * one live, which is the classic reason a "reject" button does not actually reject.
 */
export declare function denyConsent(): void;
/** Withdraw consent AND ask again on the next page view. */
export declare function revokeConsent(): void;
/** Expire every cookie Google Analytics is known to set, on every scope it may have set it on. */
export declare function deleteAnalyticsCookies(): void;
/**
 * The whole gate, for a surface that just wants it to be right.
 *
 * Call once on boot, before React mounts. It primes the denied defaults and, if the reader has
 * ALREADY granted on a previous visit, re-loads the tag — which is the branch that makes the
 * decision persistent rather than per-page. It never loads anything on a first visit, because on a
 * first visit `readConsent()` is `null` and `null` is not `'granted'`.
 */
export declare function initAnalytics(): void;
