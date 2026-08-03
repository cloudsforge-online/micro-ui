/**
 * The React deduplication is proved against a REPRODUCTION of the defect, not against a mock.
 *
 * The fixture below is the `link:` arrangement in miniature: an "app" with its own copy of React,
 * a "library" checked out elsewhere with a second copy, and a symlink from the app's node_modules
 * to the library's real directory — exactly what `link:../ui/packages/ui` produces.
 *
 * THE CONTROL IS THE POINT. Every case runs twice: once with no loader, where the assertion is
 * that the wrong copy wins, and once with the loader, where it is that the right one does. A test
 * that only ran the second half would keep passing if the fixture stopped reproducing the problem
 * — if the symlink were resolved eagerly, say, or the second copy were never installed — and would
 * then be asserting that one React is one React. The estate has produced that shape before: a page
 * compared against the same constant it rendered from, green because both sides moved together.
 * Here the two halves must disagree, and the test says so.
 *
 * The subject is `dist/test-loader.js` — the file a consumer actually loads — rather than the
 * TypeScript beside this test. `src/dist.test.ts` is what guarantees the two correspond.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { after, describe, it } from 'node:test'

import { REACT_SPECIFIERS, canonicalReact } from './test-loader.ts'

const LOADER = fileURLToPath(new URL('../dist/test-loader.js', import.meta.url))

/* ── the fixture: two copies of "react", one symlinked library ───────────────────────────────── */

// realpath, because macOS resolves /var to /private/var and the loader reports resolved paths.
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), 'cf-ui-dedupe-')))
after(() => rmSync(ROOT, { recursive: true, force: true }))

const APP = join(ROOT, 'app')
const LIB = join(ROOT, 'lib')

/** A stand-in for react: two modules that report which copy answered. */
function writeReact(dir: string, copy: string): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'react',
      version: '19.0.0',
      type: 'module',
      main: './index.js',
      exports: { '.': './index.js', './jsx-runtime': './jsx-runtime.js' },
    }),
  )
  writeFileSync(join(dir, 'index.js'), `export const COPY = ${JSON.stringify(copy)}\n`)
  writeFileSync(
    join(dir, 'jsx-runtime.js'),
    `export const COPY = ${JSON.stringify(`${copy}/jsx-runtime`)}\n`,
  )
}

mkdirSync(join(APP, 'node_modules'), { recursive: true })
writeFileSync(
  join(APP, 'package.json'),
  JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }),
)
writeReact(join(APP, 'node_modules', 'react'), 'app')

mkdirSync(LIB, { recursive: true })
writeFileSync(
  join(LIB, 'package.json'),
  JSON.stringify({
    name: 'linked',
    version: '1.0.0',
    type: 'module',
    exports: { '.': './index.js' },
  }),
)
// The library imports both the bare package and the automatic runtime, because a component built
// with the automatic JSX transform never imports 'react' at all — a fix that redirected only the
// bare specifier would collapse the hooks and leave the element factory split.
writeFileSync(
  join(LIB, 'index.js'),
  [
    "import { COPY as bare } from 'react'",
    "import { COPY as runtime } from 'react/jsx-runtime'",
    'export const SEEN = { bare, runtime }',
    '',
  ].join('\n'),
)
writeReact(join(LIB, 'node_modules', 'react'), 'lib')

// `link:` symlinks the working tree, and Node then resolves the library's bare specifiers from its
// REALPATH — which is the whole mechanism under test.
symlinkSync(LIB, join(APP, 'node_modules', 'linked'), 'dir')

/** Import the linked library from the app and report which copies of React answered it. */
function whichReact(withLoader: boolean): { bare: string; runtime: string } {
  const args = ['--input-type=module']
  if (withLoader) args.push('--import', pathToFileURL(LOADER).href)
  args.push('-e', "import { SEEN } from 'linked'; console.log(JSON.stringify(SEEN))")
  const stdout = execFileSync(process.execPath, args, { cwd: APP, encoding: 'utf8' })
  return JSON.parse(stdout.trim()) as { bare: string; runtime: string }
}

/* ── the tests ───────────────────────────────────────────────────────────────────────────────── */

describe('the fixture reproduces the defect', () => {
  it('without the loader, the linked library gets its OWN React', () => {
    // If this ever passes as `app`, the fixture has stopped modelling the problem and every
    // assertion below is measuring nothing.
    assert.deepEqual(whichReact(false), { bare: 'lib', runtime: 'lib/jsx-runtime' })
  })
})

describe('@cloudsforge/ui/test-loader', () => {
  it('gives the linked library the APP’s React, for the bare package and the jsx runtime', () => {
    assert.deepEqual(whichReact(true), { bare: 'app', runtime: 'app/jsx-runtime' })
  })

  it('redirects the runtimes an automatic-JSX build reaches for', () => {
    for (const specifier of ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom']) {
      assert.ok(REACT_SPECIFIERS.includes(specifier), `${specifier} is not deduplicated`)
    }
  })

  it('resolves from the consumer, so an app never renders on the design system’s React', () => {
    const map = canonicalReact({ from: APP })
    assert.equal(map.get('react'), pathToFileURL(join(APP, 'node_modules/react/index.js')).href)
    // react-dom is not in the fixture at all, and its absence must be silent rather than fatal:
    // an entry pointing at a file that is not there turns an unused optional runtime into a
    // resolution error in code that never asked for it.
    assert.equal(map.has('react-dom'), false)
  })

  it('refuses to pretend when there is no React to deduplicate onto', (t) => {
    // The alternative is a hook that silently redirects nothing, which reads as installed and is
    // not — the failure mode this whole change is about.
    //
    // Node walks node_modules upward from `from`, and nothing can stop it leaving the temporary
    // directory. If some ancestor of the OS temp directory happens to hold a react, this case
    // cannot be posed — so it is SKIPPED and said out loud, rather than passed.
    try {
      createRequire(join(ROOT, 'noop.cjs')).resolve('react')
      t.skip(`a react is resolvable above ${ROOT}, so "no react" cannot be arranged here`)
      return
    } catch {
      // Good: there is genuinely nothing to find.
    }
    assert.throws(() => canonicalReact({ from: ROOT }), /no 'react' resolvable/)
  })
})
