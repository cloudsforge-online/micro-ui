/**
 * CONTENT PINS: cite a line of another repository by what it SAYS, not by where it sits.
 *
 *     import { cite, block } from '@cloudsforge/ui/cite'
 *
 *     const me = cite(at('../identity/src/server.ts'), "define('GET', '/auth/me'")
 *     assert.match(block(me, 14), /user: toPublicUser\(user\)/, `GET /auth/me is at :${me.line}`)
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS, AND WHAT IT IS CAREFUL NOT TO BE
 *
 * A `path:line` citation is the estate's unit of evidence and it decays in silence. Roughly forty
 * stale ones were corrected across four repositories in a single evening; `micro-identity`'s route
 * table moved twice in one afternoon (891 → 954 → 1000), turning three frontends red for a change
 * none of them made, and reporting only ":954 is: const body = await readJson(ctx.req)" — a
 * message that tells the reader nothing about what to do.
 *
 * A CONTENT pin does not decay that way. It decays a DIFFERENT way, and both failure modes are
 * worse than the one they replace, because a line pin fails loudly and these two do not:
 *
 *   1. It matches text that has MOVED somewhere it does not belong. A pin on `toPublicUser` that
 *      finds the call site instead of the definition reads as verified and verifies nothing.
 *   2. It matches NOTHING and the test never notices — because the anchor was written loosely, or
 *      because the caller wrote `if (!existsSync(f)) return`, which reports as a pass.
 *
 * Both are the shape of check this estate keeps producing: green, and measuring nothing. So this
 * module refuses to produce either.
 *
 *   - An anchor must match EXACTLY ONE line. Zero throws. Two throws, and names both. That single
 *     rule handles both failure modes above without an arbitrary "anchors must be N characters"
 *     heuristic: an anchor loose enough to drift is, in any real file, an anchor that matches
 *     twice.
 *   - A global RegExp is refused. `/x/g.test()` alternates true and false across calls because it
 *     carries `lastIndex`, so a global anchor silently skips every other line it is tested on.
 *   - A missing file is NOT a pass. {@link cite} throws. {@link citeIfPresent} returns null —
 *     which the caller must turn into `t.skip()`, never into `return`.
 *
 * ── Where this belongs ────────────────────────────────────────────────────────────────────────
 *
 * Not, on the merits, in a design system: reading files off disk has nothing to do with tokens,
 * chrome or charts. It is here because `@cloudsforge/ui` is the ONE package every frontend already
 * resolves, and a shared helper nobody can import is not a shared helper. It sits behind its own
 * `exports` subpath and imports nothing from the browser entry points, so no bundle ever reaches
 * it. The day the estate grows a `@cloudsforge/testkit`, this module and `./test-loader` move
 * there together and this file becomes a re-export.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { existsSync, readFileSync } from 'node:fs'

/** What may be pinned on: a literal substring, or a pattern. Neither may match twice. */
export type Anchor = string | RegExp

export interface Citation {
  /** The file that was read, exactly as it was passed in. */
  readonly file: string
  /** The one line that matched, 1-based, so it can be printed as `path:line`. */
  readonly line: number
  /** The text of that line, for a failure message that shows what was found. */
  readonly text: string
  /** Every line of the file, so {@link block} needs no second read. */
  readonly lines: readonly string[]
}

const describe = (anchor: Anchor): string =>
  typeof anchor === 'string' ? JSON.stringify(anchor) : String(anchor)

function matcher(anchor: Anchor): (line: string) => boolean {
  if (typeof anchor === 'string') {
    if (anchor.trim() === '') {
      throw new Error('cite: the anchor is blank, and a blank anchor matches every line')
    }
    return (line) => line.includes(anchor)
  }
  if (anchor.global || anchor.sticky) {
    // `/x/g.test(s)` advances `lastIndex` and returns false on the next call, so a global anchor
    // tested line by line matches every other line it should. It is the exact shape of a check
    // that half works and reads as though it works.
    throw new Error(
      `cite: the anchor ${String(anchor)} carries the ${anchor.global ? 'g' : 'y'} flag. ` +
        'It is applied line by line, and a stateful regex silently skips lines. Drop the flag.',
    )
  }
  return (line) => anchor.test(line)
}

/**
 * The one line of `file` matching `anchor`.
 *
 * @throws if the file does not exist, if nothing matches, or if more than one line matches.
 */
export function cite(file: string, anchor: Anchor): Citation {
  if (!existsSync(file)) {
    throw new Error(
      `cite: ${file} does not exist. If the repository holding it may not be checked out, use ` +
        'citeIfPresent() and skip the test — do not return from it, because a test that returns ' +
        'early reports as a pass.',
    )
  }
  const test = matcher(anchor)
  const lines = readFileSync(file, 'utf8').split('\n')
  const hits: number[] = []
  for (const [i, line] of lines.entries()) if (test(line)) hits.push(i)

  const first = hits[0]
  if (first === undefined) {
    throw new Error(
      `cite: nothing in ${file} (${lines.length} lines) matches ${describe(anchor)}. ` +
        'Either the thing being cited is gone — which is the finding — or the anchor is wrong.',
    )
  }
  if (hits.length > 1) {
    throw new Error(
      `cite: ${describe(anchor)} matches ${hits.length} lines of ${file} — ` +
        `${hits.map((i) => i + 1).join(', ')}. An anchor that matches twice cannot say which one ` +
        'the claim is about, and will silently follow the wrong one when they move apart.',
    )
  }
  return { file, line: first + 1, text: lines[first] ?? '', lines }
}

/**
 * {@link cite}, except that an ABSENT FILE yields null instead of throwing — for a citation into a
 * sibling repository that may not be checked out.
 *
 * Null means "not measured". It does not mean "fine". Turn it into `t.skip('…')` so a run that
 * could not check something says so; `if (c === null) return` is how a suite comes to report a
 * pass for work it never did.
 *
 * A file that IS present is held to every rule {@link cite} applies. Being optional about whether
 * the repository is there is not being optional about whether the claim holds.
 */
export function citeIfPresent(file: string, anchor: Anchor): Citation | null {
  if (!existsSync(file)) return null
  return cite(file, anchor)
}

/**
 * `count` lines of the file starting at the citation — the block the anchor heads.
 *
 * Returned joined, so a claim about the block is one `assert.match` away. It is deliberately NOT
 * padded when the anchor sits near the end of the file: a short block fails an assertion, which is
 * the correct outcome for a file that has lost the body being cited.
 */
export function block(citation: Citation, count: number): string {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`cite: block() needs a positive whole number of lines, got ${count}`)
  }
  return citation.lines.slice(citation.line - 1, citation.line - 1 + count).join('\n')
}
