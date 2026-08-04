#!/usr/bin/env node
/**
 * THE FOOTER GUARD: every surface of a running estate, in a real browser, stubbing nothing.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS AND NOT ANOTHER UNIT TEST
 *
 * `packages/ui/src/footer.test.ts` renders `CloudsForgeFooter` with React and asserts its
 * structure. Everything it says is true of the COMPONENT. None of it is evidence that any of the
 * nineteen surfaces in this estate actually put that component on a page, and this estate has
 * already shipped sixteen frontends whose suites were green while the pages were unusable.
 *
 * The specific failure this guard is built to catch is a silent one: a shell edited so the footer
 * is no longer rendered. Nothing goes red for that. The app still builds, its own tests still
 * pass (they render pages, not the shell), nginx still answers 200, `beacon smoke` still finds the
 * text it looks for, and the page just quietly loses its navigation of last resort — which is the
 * state nine of these surfaces were already in when this work started.
 *
 * So this asks the only question that cannot be faked: **is there a contentinfo landmark on the
 * page a browser renders from the address a person types, and does it hold the links the registry
 * says it should?**
 *
 * IT REFUSES TO PASS WHEN IT DID NOT RUN. No Chromium, no estate, no certificate — every one of
 * those is exit 2 with a reason, never a green. `micro-beacon`'s journeys.ts rule 2 in this
 * repository's own words: not-run is not passed.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 *
 *   pnpm footer-audit                              # against the local estate
 *   pnpm footer-audit --apex cloudsforge.online    # against anything else
 *   pnpm footer-audit --surface trade,market       # one or two, while iterating
 *
 * ── On TLS ────────────────────────────────────────────────────────────────────────────────────
 *
 * The link-reachability probe uses the estate CA (`--cacert`, default
 * `../deploy/gateway/certs/ca.crt`) and NEVER `-k`: a footer link that resolves to a host with a
 * broken certificate is a broken link, and a probe that ignores TLS could not tell.
 *
 * Chromium cannot be handed a CA file, so it gets `--ignore-certificate-errors-spki-list` with the
 * SHA-256 of the public key this gateway is ACTUALLY serving, read off the wire first. That is the
 * narrow form: an expired certificate on another host, one issued for the wrong name, and an
 * active substitution all still fail. It is the same mechanism `beacon/src/browser/estatecert.ts`
 * chose, for the same reason.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { request } from 'node:https'
import { dirname, join, resolve } from 'node:path'
import { connect } from 'node:tls'
import { fileURLToPath } from 'node:url'
import { SURFACES, type CloudsForgeSurface } from '../packages/ui/src/surfaces.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * SURFACES THAT DO NOT YET RENDER THE SHARED FOOTER
 *
 * Three, and each is here for the same reason: it is owned by another agent in this pass and this
 * repository has read it as evidence without writing to it. This is NOT a way to switch the guard
 * off, and the assertion below makes that structural — **an entry that HAS a footer fails the
 * run** and must be deleted. Same shape as `contrast.test.ts`'s "still needs every decoration
 * exemption it claims", and as the frontends' `assertKnownStillBroken`: an exemption that has
 * stopped being needed is a licence sitting there quietly excusing the next regression.
 *
 * Everything else in the registry that serves a page must have one, by name, with no opt-out.
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */
const NOT_YET_ADOPTED: ReadonlyMap<string, string> = new Map([
  ['site', 'micro-site — held by another agent; it has its own four-column footer already'],
  ['explorer', 'micro-explorer-web — held by another agent'],
  ['network', 'micro-network-site — held by another agent; renders no footer at all today'],
])

/* The minimum of playwright-core this file drives. Declared structurally for the same reason
 * beacon's driver.ts does: importing its types would make an optional dependency mandatory. */
interface Page {
  goto(u: string, o?: { waitUntil?: string; timeout?: number }): Promise<{ status(): number } | null>
  waitForLoadState(s: string, o?: { timeout?: number }): Promise<void>
  evaluate<T>(fn: () => T): Promise<T>
  setDefaultTimeout(ms: number): void
  keyboard: { press(key: string): Promise<void> }
  fill(selector: string, value: string, o?: { timeout?: number }): Promise<void>
  click(selector: string, o?: { timeout?: number }): Promise<void>
  waitForURL(p: (u: URL) => boolean, o?: { timeout?: number }): Promise<void>
  url(): string
  close(): Promise<void>
}

interface Chromium {
  launch(o: { executablePath?: string; args?: readonly string[] }): Promise<{
    newContext(o: unknown): Promise<{ newPage(): Promise<Page> }>
    close(): Promise<void>
  }>
  executablePath(): string
}

interface Options {
  readonly apex: string
  readonly caCert: string
  readonly browser: string
  readonly timeoutMs: number
  readonly only: readonly string[]
  /**
   * The account used for the second pass, over the surfaces that will not show themselves to a
   * stranger. Same defaults and the same estate account as `beacon smoke`
   * (`BEACON_SMOKE_IDENTIFIER` / `_PASSWORD` / `_HANDLE`), because a second set of credentials for
   * the same estate is a second thing to rotate and a second thing to be wrong.
   */
  readonly identifier: string
  readonly password: string
  readonly handle: string
}

function parseArgs(argv: readonly string[]): Options {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag)
    return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : fallback
  }
  const only = get('--surface', '')
  return {
    apex: get('--apex', process.env['CF_WEB_APEX'] ?? 'cloudsforge.localtest.me'),
    caCert: get('--cacert', join(ROOT, '..', 'deploy', 'gateway', 'certs', 'ca.crt')),
    browser: get('--browser', process.env['CF_BROWSER_EXECUTABLE'] ?? ''),
    timeoutMs: Number(get('--timeout', '20000')),
    only: only === '' ? [] : only.split(',').map((s) => s.trim()),
    identifier:
      process.env['CF_FOOTER_IDENTIFIER'] ??
      process.env['BEACON_SMOKE_IDENTIFIER'] ??
      'estate-admin@example.test',
    password:
      process.env['CF_FOOTER_PASSWORD'] ??
      process.env['BEACON_SMOKE_PASSWORD'] ??
      'correct-horse-battery-staple-42',
    handle: process.env['CF_FOOTER_HANDLE'] ?? process.env['BEACON_SMOKE_HANDLE'] ?? 'estateadmin',
  }
}

/** Exit 2: the guard could not run. Distinct from exit 1, which is a surface that is broken. */
function cannotRun(reason: string): never {
  process.stderr.write(`\n  footer-audit CANNOT RUN: ${reason}\n\n`)
  process.exit(2)
}

/* ─────────────────────────────────────────── what to check ─────────────────────────────────── */

/**
 * The surfaces this guard visits: every registry row that serves a page ON ITS OWN HOST.
 *
 * `basePath` rows are excluded because they are a route on another surface's host — `hub/account`,
 * `hub/wallet`, `network/faucet` — and visiting them would audit the same shell twice while
 * reporting it as two surfaces. Derived, so a new frontend is covered the day its registry row
 * lands rather than the day somebody remembers this file.
 */
function auditTargets(opts: Options): readonly CloudsForgeSurface[] {
  const all = SURFACES.filter((s) => s.servesUi && s.basePath === undefined)
  if (opts.only.length === 0) return all
  const picked = all.filter((s) => opts.only.includes(s.key))
  if (picked.length !== opts.only.length) {
    cannotRun(`unknown surface in --surface; known: ${all.map((s) => s.key).join(', ')}`)
  }
  return picked
}

function urlFor(s: CloudsForgeSurface, apex: string): string {
  return `https://${s.subdomain === '' ? '' : `${s.subdomain}.`}${apex}/`
}

/* ─────────────────────────────────────────── TLS ──────────────────────────────────────────── */

/** base64(SHA-256(SPKI)) of the certificate this apex is serving right now. */
async function spkiPin(host: string): Promise<string> {
  return new Promise((ok, no) => {
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerX509Certificate()
      socket.end()
      if (!cert) return no(new Error(`${host} presented no certificate`))
      ok(createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64'))
    })
    socket.setTimeout(8000, () => {
      socket.destroy()
      no(new Error(`${host} did not complete a TLS handshake within 8s`))
    })
    socket.on('error', no)
  })
}

/** GET a URL against the estate CA. Never `rejectUnauthorized: false`. */
async function statusOf(url: string, ca: Buffer): Promise<number | string> {
  return new Promise((ok) => {
    const req = request(url, { ca, method: 'GET', timeout: 10000 }, (res) => {
      res.resume()
      ok(res.statusCode ?? 0)
    })
    req.on('timeout', () => {
      req.destroy()
      ok('timeout')
    })
    req.on('error', (e) => ok(e.message))
    req.end()
  })
}

/* ─────────────────────────── what one page said about its footer ──────────────────────────── */

interface FooterReport {
  readonly landmarks: number
  /**
   * Is this the SHARED footer, or a local one?
   *
   * `.cf-foot` is `CloudsForgeFooter`'s own class and `@cloudsforge/ui` is the only thing that
   * emits it, so this separates "has a footer" from "has THE footer". Both questions matter and
   * they are not the same: `micro-site` has had a four-column footer of its own all along, and a
   * guard that could not tell the two apart would have called that adoption.
   */
  readonly shared: boolean
  readonly explicitRole: boolean
  readonly labelledNavs: number
  readonly unlabelledNavs: number
  readonly headings: readonly string[]
  readonly links: readonly { href: string; text: string; current: boolean; focusable: boolean }[]
  readonly background: string
  readonly linkColour: string
  readonly tabbedTo: boolean
}

/**
 * Read the footer out of the live page.
 *
 * Everything asserted is something the APPLICATION produced. `background` in particular is the
 * computed style: `rgba(0, 0, 0, 0)` means the stylesheet did not reach the page, which is the
 * exact defect that had three surfaces rendering unstyled in this estate — a footer whose markup
 * is perfect and whose CSS never arrived is not a footer anybody can read.
 */
const READ_FOOTER = function (): FooterReport {
  const d = document
  const foots = Array.from(d.querySelectorAll('footer, [role="contentinfo"]'))
  const foot = foots[0] as HTMLElement | undefined
  const navs = foot ? Array.from(foot.querySelectorAll('nav')) : []
  const anchors = foot ? Array.from(foot.querySelectorAll('a')) : []
  const active = d.activeElement

  const links = anchors.map((a) => {
    // A REAL focus attempt, not a tabindex read: `focus()` is refused by a display:none or
    // visibility:hidden element, which is precisely how a "present" link becomes unreachable.
    a.focus()
    const focusable = d.activeElement === a
    return {
      href: a.getAttribute('href') ?? '',
      text: (a.textContent ?? '').trim(),
      current: a.getAttribute('aria-current') === 'page',
      focusable,
    }
  })
  if (active instanceof HTMLElement) active.focus()

  return {
    landmarks: foots.length,
    shared: Boolean(d.querySelector('footer.cf-foot')),
    explicitRole: foot?.getAttribute('role') === 'contentinfo',
    labelledNavs: navs.filter((n) => n.getAttribute('aria-labelledby') ?? n.getAttribute('aria-label')).length,
    unlabelledNavs: navs.filter((n) => !(n.getAttribute('aria-labelledby') ?? n.getAttribute('aria-label'))).length,
    headings: foot ? Array.from(foot.querySelectorAll('h2')).map((h) => (h.textContent ?? '').trim()) : [],
    links,
    background: foot ? getComputedStyle(foot).backgroundColor : '',
    linkColour: anchors[0] ? getComputedStyle(anchors[0]).color : '',
    tabbedTo: false,
  }
}

/* ═════════════════════════════════ what one surface said ═════════════════════════════════════ */

interface SurfaceResult {
  readonly problems: readonly string[]
  readonly line: string
  /**
   * The surface sent a signed-out visitor to a DIFFERENT origin — in practice, to the sign-in page
   * on Hub. Its own footer was therefore never on screen and nothing about it has been proved.
   *
   * This is not a pass and it is not a failure; it is "ask again with a session", and the run does
   * exactly that. **It was found by this guard rather than reasoned about**: the first live run
   * reported `admin`, `foresight-admin`, `emberkin` and `aetherholm` as marking "Forge Hub" as the
   * current surface, which is impossible on those pages and was in fact Hub's own footer being
   * read after four silent redirects. A guard that had only looked at the DOM would have been
   * measuring the wrong page and calling it green the moment the message happened to agree.
   */
  readonly gated: boolean
}

async function checkSurface(
  page: Page,
  s: CloudsForgeSurface,
  opts: Options,
  offered: Set<string>,
  session: 'signed-out' | 'operator',
): Promise<SurfaceResult> {
  const url = urlFor(s, opts.apex)
  const problems: string[] = []
  const isAdmin = session === 'operator'

  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: opts.timeoutMs })
    if (!res || res.status() >= 400) problems.push(`HTTP ${res ? res.status() : 'no response'}`)
    await page.waitForLoadState('networkidle', { timeout: opts.timeoutMs }).catch(() => undefined)

    // BEFORE reading a single element: is this still the page that was asked for?
    const origin = new URL(url).origin
    if (new URL(page.url()).origin !== origin) {
      if (session === 'signed-out') {
        return {
          problems: [],
          line: `  gate  ${s.key.padEnd(16)} sends a signed-out visitor to ${new URL(page.url()).origin}`,
          gated: true,
        }
      }
      /*
       * Being off-origin WITH a session is the hand-off in flight, not a failure — yet. The
       * consoles bounce to `hub/account/login`, the portal recognises the session, and the browser
       * is sent back with a one-time code; `networkidle` can fall in the middle of that.
       *
       * This wait is here because the guard flaked without it: `emberkin` and `aetherholm` passed
       * one run and were caught mid-hand-off on the next. beacon's smoke records the same
       * behaviour on `foresight-admin` and its conclusion is the one adopted here — "an assertion
       * that is sometimes right is worse than none, because it teaches people to re-run". So the
       * hand-off is WAITED FOR, with a bound, and a hand-off that never completes is still a
       * failure with its own message rather than a retry loop that hides one.
       */
      await page
        .waitForURL((u) => u.origin === origin, { timeout: opts.timeoutMs })
        .catch(() => undefined)
      await page.waitForLoadState('networkidle', { timeout: opts.timeoutMs }).catch(() => undefined)
      if (new URL(page.url()).origin !== origin) {
        problems.push(
          `never came back from ${new URL(page.url()).origin} with an operator session — the ` +
            `sign-in hand-off did not complete within ${opts.timeoutMs}ms`,
        )
        return { problems, line: `  FAIL  ${s.key.padEnd(16)} ${url}`, gated: false }
      }
    }

    const r = (await page.evaluate(READ_FOOTER)) as FooterReport
    const exempt = NOT_YET_ADOPTED.get(s.key)

    if (exempt !== undefined) {
      // The self-deleting half. An exemption that is no longer true must be removed, or it
      // becomes an off-switch nobody remembers granting. The test is for the SHARED footer, not
      // for any footer: `site` has carried a bespoke one throughout and that is not adoption.
      if (r.shared) {
        problems.push(
          `is listed in NOT_YET_ADOPTED ("${exempt}") and now renders the SHARED footer — ` +
            'delete the entry, or this guard is excusing a surface it should be checking',
        )
      }
      return { problems, line: `  skip  ${s.key.padEnd(16)} ${exempt}`, gated: false }
    }

    /* --- the landmark ------------------------------------------------------------------ */
    if (r.landmarks === 0) problems.push('NO footer landmark on the rendered page')
    if (!r.shared) problems.push('does not render @cloudsforge/ui’s CloudsForgeFooter')
    if (r.landmarks > 1) problems.push(`${r.landmarks} footer landmarks; there must be one`)
    if (r.landmarks === 1 && !r.explicitRole) problems.push('the footer does not state role="contentinfo"')

    /* --- it is navigation, and navigation is labelled ---------------------------------- */
    if (r.unlabelledNavs > 0) problems.push(`${r.unlabelledNavs} unlabelled <nav> inside the footer`)
    if (r.labelledNavs < 4) problems.push(`only ${r.labelledNavs} labelled columns; expected 4`)
    if (r.headings.length < 4) problems.push(`only ${r.headings.length} column headings`)

    /* --- the links are the registry's, and nobody else's ------------------------------- */
    const expected = new Set(
      SURFACES.filter((x) => x.servesUi && x.key !== 'signin' && (isAdmin || x.adminOnly !== true)).map(
        (x) => `https://${x.subdomain === '' ? '' : `${x.subdomain}.`}${opts.apex}${x.basePath ?? ''}`,
      ),
    )
    const seen = new Set<string>()
    for (const l of r.links) {
      offered.add(l.href)
      seen.add(l.href.replace(/\/$/, ''))
      if (!l.focusable) problems.push(`"${l.text}" cannot take focus — unreachable by keyboard`)
      if (l.text.length === 0) problems.push(`a link with no text at ${l.href}`)
      if (/^(click here|here|read more|more|link|this)$/i.test(l.text)) {
        problems.push(`link text "${l.text}" means nothing out of context`)
      }
    }
    for (const want of expected) {
      if (!seen.has(want.replace(/\/$/, ''))) problems.push(`does not offer ${want}`)
    }

    /* --- adminOnly, on both sides ------------------------------------------------------ */
    for (const admin of SURFACES.filter((x) => x.adminOnly === true && x.servesUi)) {
      const shown = r.links.some((l) => l.text === admin.name)
      if (!isAdmin && shown) {
        problems.push(`advertises the operator surface "${admin.name}" to a signed-out visitor`)
      }
      // The inverse, so "hidden from everybody" cannot pass as "hidden from strangers". A rule
      // that only ever removes things is satisfied by removing everything.
      if (isAdmin && !shown) problems.push(`hides "${admin.name}" from a signed-in operator`)
    }

    /* --- the current surface is marked, once ------------------------------------------- */
    const marked = r.links.filter((l) => l.current)
    if (marked.length > 1) problems.push(`${marked.length} links marked aria-current`)
    if (marked.length === 1 && marked[0]?.text !== s.name) {
      problems.push(`marks "${marked[0]?.text}" as current on the ${s.name} surface`)
    }

    /* --- the stylesheet reached the page ----------------------------------------------- */
    if (r.landmarks > 0 && (r.background === 'rgba(0, 0, 0, 0)' || r.background === '')) {
      problems.push(`the footer computes to ${r.background || 'no'} background — its CSS never arrived`)
    }

    /* --- keyboard: reached by tabbing from the top of the document --------------------- */
    // Not a tabindex read and not `focus()`: real Tab presses from the document start, which is
    // the only thing that proves the footer is IN the tab sequence rather than merely focusable.
    let tabbedTo = false
    if (r.landmarks > 0 && r.links.length > 0) {
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      for (let i = 0; i < 400 && !tabbedTo; i += 1) {
        await page.keyboard.press('Tab')
        tabbedTo = await page.evaluate(() =>
          Boolean(document.activeElement?.closest('footer, [role="contentinfo"]')),
        )
      }
      if (!tabbedTo) problems.push('400 Tab presses never reached the footer')
    }

    return {
      problems,
      line:
        `  ${problems.length === 0 ? 'pass' : 'FAIL'}  ${s.key.padEnd(16)} ` +
        `${r.links.length} links, ${r.headings.length} columns, bg ${r.background}` +
        `${tabbedTo ? ', tab-reachable' : ''}${isAdmin ? ', operator' : ''}  ${url}`,
      gated: false,
    }
  } catch (e) {
    problems.push(`threw: ${(e as Error).message.split('\n')[0]}`)
    return { problems, line: `  FAIL  ${s.key.padEnd(16)} ${url}`, gated: false }
  }
}

/**
 * Sign in at the estate's own sign-in surface, so the gated consoles can be looked at.
 *
 * Same address, same field names and same defaults as `beacon/src/browser/smoke.ts` — deliberately
 * not a second opinion about how one signs into this estate. `identifier`, not `email`: the field
 * takes an address OR a handle, and a script that typed into `input[name=email]` would fail on a
 * page that is working.
 */
async function signIn(page: Page, opts: Options): Promise<string | null> {
  const url = `https://hub.${opts.apex}/account/login`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs })
    await page.waitForLoadState('networkidle', { timeout: opts.timeoutMs }).catch(() => undefined)
    await page.fill('input[name=identifier]', opts.identifier)
    await page.fill('input[name=password]', opts.password)
    await page.click('button[type=submit]')
    await page.waitForURL((u) => !u.pathname.startsWith('/account'), { timeout: opts.timeoutMs })
    await page.waitForLoadState('networkidle', { timeout: opts.timeoutMs }).catch(() => undefined)
  } catch (e) {
    return `${url}: ${(e as Error).message.split('\n')[0]}`
  }
  const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')
  // Reaching a page is not a session. beacon's smoke makes the same distinction, in the same words.
  if (!text.includes(opts.handle)) {
    return `signed in and landed at ${page.url()}, which does not render the handle "${opts.handle}"`
  }
  return null
}

/* ────────────────────────────────────────── the run ───────────────────────────────────────── */

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2))

  if (!existsSync(opts.caCert)) {
    cannotRun(
      `no CA at ${opts.caCert}. This guard verifies certificates rather than ignoring them; ` +
        'pass --cacert, or bring up deploy/gateway which writes it.',
    )
  }
  const ca = readFileSync(opts.caCert)

  let chromium: Chromium
  try {
    ;({ chromium } = (await import('playwright-core')) as unknown as { chromium: Chromium })
  } catch (e) {
    cannotRun(`playwright-core is not installed (${(e as Error).message.split('\n')[0]})`)
  }

  let executable = opts.browser
  if (executable === '') {
    try {
      executable = chromium.executablePath()
    } catch (e) {
      cannotRun(`no Chromium (${(e as Error).message.split('\n')[0]}) — pass --browser`)
    }
  }
  if (!existsSync(executable)) {
    // The distinction beacon's driver.ts paid a CI run to learn: the package being installed is
    // not the browser existing.
    cannotRun(`playwright-core names ${executable} and nothing is there`)
  }

  const targets = auditTargets(opts)
  const apexStatus = await statusOf(`https://${opts.apex}/`, ca)
  if (typeof apexStatus !== 'number') {
    cannotRun(`the estate is not answering at https://${opts.apex}/ (${apexStatus})`)
  }

  const pin = await spkiPin(opts.apex).catch((e: Error) => cannotRun(e.message))

  const browser = await chromium.launch({
    executablePath: executable,
    args: [`--ignore-certificate-errors-spki-list=${pin}`],
  })

  const failures: string[] = []
  const lines: string[] = []
  /** Every distinct address any footer offered, so each is probed once rather than nineteen times. */
  const offered = new Set<string>()
  const gated: CloudsForgeSurface[] = []

  /* ── pass one: as a stranger. This is the pass `adminOnly` is judged on. ───────────────── */
  const anonymous = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  for (const s of targets) {
    const page = await anonymous.newPage()
    page.setDefaultTimeout(opts.timeoutMs)
    const r = await checkSurface(page, s, opts, offered, 'signed-out')
    await page.close()
    lines.push(r.line)
    /*
     * A REDIRECT IS ONE WAY TO BE GATED, NOT THE DEFINITION OF IT. `checkSurface` can only set
     * `gated` by watching the origin change, so `lantern` and `beacon` — which present an in-page
     * sign-in panel and never leave their own origin — were never added here, never signed into,
     * and so the two assertions below that need an operator session silently never ran for them.
     * They were the surfaces most worth checking: both are `adminOnly`.
     *
     * The registry is asked instead of the DOM. Sniffing for a sign-in control would misclassify
     * all sixteen, because the shared bar shows one on every signed-out surface. And `adminOnly`
     * is the very property those assertions are about, so reading it here is the same question
     * asked once rather than two questions that can disagree. Surfaces gated by redirect but not
     * `adminOnly` — emberkin, aetherholm — stay classified exactly as they were.
     */
    if (r.gated || s.adminOnly === true) gated.push(s)
    if (r.problems.length > 0) failures.push(`${s.key}: ${r.problems.join('; ')}`)
  }

  /* ── pass two: the surfaces that would not show themselves to a stranger ───────────────── *
   *
   * A SKIP HERE WOULD BE THE WHOLE GUARD'S UNDOING: `admin` and `foresight-admin` are the two
   * surfaces where an `adminOnly` link is allowed to appear, so they are the two whose footers
   * most need looking at. Not-run is not passed — if this pass cannot be made to happen, the run
   * exits 2 rather than reporting on the surfaces it did manage.
   * ──────────────────────────────────────────────────────────────────────────────────────── */
  if (gated.length > 0) {
    const session = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const login = await session.newPage()
    login.setDefaultTimeout(opts.timeoutMs)
    const failed = await signIn(login, opts)
    await login.close()
    if (failed !== null) {
      await browser.close()
      cannotRun(
        `${gated.length} surfaces (${gated.map((s) => s.key).join(', ')}) require an operator ` +
          `session — by redirecting a stranger to sign-in, or by being adminOnly — and this run ` +
          `could not sign in — ${failed}. Their footers are therefore unproven. ` +
          'Set CF_FOOTER_IDENTIFIER / CF_FOOTER_PASSWORD / CF_FOOTER_HANDLE.',
      )
    }
    for (const s of gated) {
      const page = await session.newPage()
      page.setDefaultTimeout(opts.timeoutMs)
      const r = await checkSurface(page, s, opts, offered, 'operator')
      await page.close()
      lines.push(r.line)
      if (r.problems.length > 0) failures.push(`${s.key}: ${r.problems.join('; ')}`)
    }
  }

  await browser.close()

  /* --- every address any footer offered must actually answer ---------------------------- */
  const deadLinks: string[] = []
  for (const href of [...offered].sort()) {
    const code = await statusOf(href, ca)
    if (code !== 200) deadLinks.push(`${href} → ${code}`)
  }

  process.stdout.write(`\n${lines.join('\n')}\n`)
  process.stdout.write(
    `\n  probed ${offered.size} distinct footer destinations against ${opts.caCert}\n`,
  )
  if (deadLinks.length > 0) {
    failures.push(`footer links that do not answer 200:\n      ${deadLinks.join('\n      ')}`)
  }

  const checked = targets.filter((s) => !NOT_YET_ADOPTED.has(s.key)).length
  if (checked === 0) cannotRun('every requested surface is exempt — this run proved nothing')

  if (failures.length > 0) {
    process.stderr.write(`\n  ${failures.length} FAILING:\n\n    ${failures.join('\n    ')}\n\n`)
    process.exit(1)
  }
  process.stdout.write(
    `\n  ${checked}/${checked} surfaces carry the shared footer` +
      `${gated.length > 0 ? ` (${gated.length} of them behind sign-in, checked with an operator session)` : ''}\n\n`,
  )
}

await main()
