/**
 * A content pin is only better than a line pin if it cannot rot in silence, so what is asserted
 * here is mostly the REFUSALS.
 *
 * The three ways this helper could be worse than the `path:line` it replaces, each with a case
 * below: an anchor that matches nothing and reads as verified; an anchor that matches twice and
 * follows the wrong one when they move apart; and a citation into a repository that is not checked
 * out, returning early and reporting as a pass.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, describe, it } from 'node:test'

import { block, cite, citeIfPresent } from './cite.ts'

const DIR = mkdtempSync(join(tmpdir(), 'cf-ui-cite-'))
after(() => rmSync(DIR, { recursive: true, force: true }))

/** A stand-in for another repository's source file. */
function fixture(name: string, lines: readonly string[]): string {
  const path = join(DIR, name)
  writeFileSync(path, lines.join('\n'))
  return path
}

const SERVER = fixture('server.ts', [
  "import { define } from './router.ts'", // 1
  '', // 2
  '// GET /auth/me — the profile, nested under `user`.', // 3
  "define('GET', '/auth/me', async (ctx) => {", // 4
  '  const user = await requireUser(ctx)', // 5
  '  return json(200, { user: toPublicUser(user) })', // 6
  '})', // 7
  '', // 8
  "define('POST', '/auth/handoff/redeem', async (ctx) => {", // 9
  '  return json(200, { token })', // 10
  '})', // 11
])

const ABSENT = join(DIR, 'not-checked-out.ts')

describe('cite', () => {
  it('finds the one line that matches, and reports it 1-based', () => {
    const c = cite(SERVER, "define('GET', '/auth/me'")
    assert.equal(c.line, 4)
    assert.match(c.text, /'\/auth\/me'/)
  })

  it('survives the move that broke the line pin', () => {
    // The same file with twenty lines inserted above the route — micro-identity's route table
    // moved 891 → 954 → 1000 in one afternoon and turned three frontends red. The pin does not
    // move, and the line it reports does.
    const moved = fixture('server-moved.ts', [
      ...Array.from({ length: 20 }, (_, i) => `// preamble ${i}`),
      ...['', "define('GET', '/auth/me', async (ctx) => {", '  return json(200, { user: p })', '})'],
    ])
    const c = cite(moved, "define('GET', '/auth/me'")
    assert.equal(c.line, 22)
  })

  it('accepts a RegExp as well as a substring', () => {
    assert.equal(cite(SERVER, /^define\('GET'/).line, 4)
  })

  it('THROWS when nothing matches, rather than reporting a pass', () => {
    assert.throws(
      () => cite(SERVER, "define('GET', '/auth/whoami'"),
      /nothing in .* matches/,
      'an anchor that matches nothing is the silent failure a content pin is accused of',
    )
  })

  it('THROWS when the anchor matches twice, naming every line it hit', () => {
    assert.throws(
      () => cite(SERVER, 'define('),
      (e: Error) => /matches 2 lines/.test(e.message) && /4, 9/.test(e.message),
    )
  })

  it('THROWS on a blank anchor, which would otherwise match the first line of anything', () => {
    assert.throws(() => cite(SERVER, '   '), /blank anchor/)
  })

  it('THROWS on a stateful regex, which skips every other line it is tested on', () => {
    // /x/g.test() advances lastIndex between calls. Applied line by line it matches, then misses,
    // then matches — so the count is wrong and the uniqueness rule above stops protecting anyone.
    assert.throws(() => cite(SERVER, /define\(/g), /carries the g flag/)
    assert.throws(() => cite(SERVER, /define\(/y), /carries the y flag/)
  })

  it('THROWS on a file that is not there, and says what to do instead', () => {
    assert.throws(() => cite(ABSENT, 'anything'), /citeIfPresent\(\)/)
  })
})

describe('block', () => {
  it('returns the lines the anchor heads, so a claim is asserted against the body', () => {
    const c = cite(SERVER, "define('GET', '/auth/me'")
    assert.match(block(c, 3), /user: toPublicUser\(user\)/)
  })

  it('does NOT reach into the next handler, so a claim cannot be satisfied by its neighbour', () => {
    // The failure mode a content pin is genuinely exposed to: matching text that has moved
    // somewhere it does not belong. A window that ran to the end of the file would let
    // /auth/handoff/redeem's body answer for /auth/me's.
    const c = cite(SERVER, "define('GET', '/auth/me'")
    assert.doesNotMatch(block(c, 4), /handoff/)
  })

  it('stops at the end of the file instead of padding, so a truncated body fails', () => {
    const c = cite(SERVER, "define('POST', '/auth/handoff/redeem'")
    assert.equal(block(c, 500).split('\n').length, 3)
    assert.doesNotMatch(block(c, 500), /toPublicUser/)
  })

  it('THROWS on a window of zero or fewer lines', () => {
    assert.throws(() => block(cite(SERVER, 'router.ts'), 0), /positive whole number/)
  })
})

describe('citeIfPresent', () => {
  it('returns null for a repository that is not checked out', () => {
    assert.equal(citeIfPresent(ABSENT, "define('GET', '/auth/me'"), null)
  })

  it('holds a file that IS present to every rule, including uniqueness', () => {
    // Being optional about whether the repository is there is not being optional about whether the
    // claim holds. A "soft" variant that swallowed a bad anchor would be the worse of both.
    assert.throws(() => citeIfPresent(SERVER, 'define('), /matches 2 lines/)
    assert.throws(() => citeIfPresent(SERVER, 'nothing here'), /nothing in/)
    assert.equal(citeIfPresent(SERVER, "define('GET', '/auth/me'")?.line, 4)
  })
})
