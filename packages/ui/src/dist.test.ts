/**
 * THE ENTRY POINTS NAME BUILT OUTPUT, THE BUILT OUTPUT IS COMMITTED, AND IT IS THE OUTPUT OF THESE
 * SOURCES.
 *
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS FILE CLOSES
 *
 * `package.json` used to name `./src/index.tsx` as the entry point of every subpath, and reserve
 * `dist` for `publishConfig` — the block npm applies at PUBLISH time and nothing else ever reads.
 * Since this package has never been published, and is consumed by all thirteen frontends through
 * `link:../ui/packages/ui`, the consequence was that:
 *
 *   1. Every consumer compiled this package's TSX with ITS OWN toolchain. Under `node --test` that
 *      means `tsx`, which applies the CONSUMING repository's tsconfig — whose `include` never
 *      covers a sibling's sources — so esbuild fell back to the CLASSIC JSX transform and emitted
 *      `React.createElement` into a module that imports no React. Eight frontends worked around it
 *      by installing a `globalThis.React`; each carries a comment saying so.
 *   2. The artefact that WOULD be published had never been run by anything. `pnpm build` is not in
 *      this repository's CI (the job is named "Typecheck, test, build" and has no build step), so
 *      `dist` was produced only by `prepack`, on a publish that has not happened. That is the
 *      shape that let `micro-service-template` ship a Docker image which could never boot: CI
 *      built it, read its metadata, and never ran it.
 *
 * Both are closed by naming `dist` in `exports` and committing it. Committed build output is a
 * real cost — it is why the tests below exist — but it is the only shape that reaches a consumer,
 * because nothing on any consumer's path runs a build here: not `pnpm install`, not the
 * Dockerfiles (which `COPY --from=uipkg packages/ui`), and not the second checkout in each
 * frontend's CI.
 *
 * THE COST IS STALENESS, AND STALENESS IS WHAT IS ASSERTED. The parity test recompiles `src/` into
 * a temporary directory on every run and compares byte for byte. It is not self-referential: one
 * side is the bytes in git, the other is a fresh compile of the sources, and editing a source
 * without rebuilding moves exactly one of them.
 *
 * It also means the build RUNS on every `pnpm test`, in CI, which is the part that was missing.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, describe, it } from 'node:test'

const PKG_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(PKG_ROOT, 'src')
const DIST = join(PKG_ROOT, 'dist')

interface PackageJson {
  readonly main?: string
  readonly types?: string
  readonly exports?: Record<string, string | Record<string, string>>
  readonly publishConfig?: Record<string, unknown>
  readonly files?: readonly string[]
}

const PKG = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as PackageJson

/** Every path an `exports` entry points at, whatever condition it sits behind. */
function exportTargets(): { subpath: string; condition: string; target: string }[] {
  const out: { subpath: string; condition: string; target: string }[] = []
  for (const [subpath, value] of Object.entries(PKG.exports ?? {})) {
    if (typeof value === 'string') out.push({ subpath, condition: 'default', target: value })
    else {
      for (const [condition, target] of Object.entries(value)) {
        out.push({ subpath, condition, target })
      }
    }
  }
  return out
}

describe('the package resolves to built output', () => {
  it('names entry points at all, so the checks below cannot pass on an empty map', () => {
    // Without this, deleting `exports` would turn every assertion in this block into a loop over
    // nothing and the file would read as a guarantee while measuring none.
    assert.ok(exportTargets().length >= 8, `only ${exportTargets().length} export targets`)
  })

  it('points every entry at ./dist, never at ./src', () => {
    // The regression this whole change exists to prevent. An entry naming ./src hands this
    // package's TSX to thirteen other toolchains, and hands the classic JSX transform to the
    // Node test loader in every one of them.
    const source = exportTargets().filter(
      (e) =>
        e.target.startsWith('./src/') ||
        e.target.endsWith('.tsx') ||
        (e.target.endsWith('.ts') && !e.target.endsWith('.d.ts')),
    )
    assert.deepEqual(
      source.map((e) => `exports["${e.subpath}"].${e.condition} = ${e.target}`),
      [],
      'a link: consumer resolves the working tree, so a src entry point is what it compiles',
    )
    assert.equal(PKG.main, './dist/index.js')
    assert.equal(PKG.types, './dist/index.d.ts')
  })

  it('points every entry at a file that is actually on disk', () => {
    const missing = exportTargets().filter(
      (e) => e.target !== './package.json' && !existsRelative(e.target),
    )
    assert.deepEqual(
      missing.map((e) => `exports["${e.subpath}"] names ${e.target}, which does not exist`),
      [],
    )
  })

  it('does not let publishConfig restate the entry points', () => {
    // publishConfig used to hold a SECOND exports map, applied only by `npm publish`. Two maps
    // meant the shape every consumer used and the shape that would be released were different
    // objects, and nothing compared them. Whatever is asserted above must be the published shape.
    const pc = PKG.publishConfig ?? {}
    assert.deepEqual(
      Object.keys(pc).filter((k) => ['exports', 'main', 'types', 'module'].includes(k)),
      [],
      'publishConfig must not re-point the entry points; the working tree is what ships',
    )
  })

  it('packs the directory it points at', () => {
    assert.deepEqual([...(PKG.files ?? [])], ['dist'])
  })
})

describe('the built entry point uses the automatic JSX runtime', () => {
  const INDEX = readFileSync(join(DIST, 'index.js'), 'utf8')
  const CHARTS = readFileSync(join(DIST, 'charts.js'), 'utf8')

  it('imports the jsx runtime rather than expecting a React global', () => {
    // This is the assertion that fails if the build is ever reconfigured back to the classic
    // transform — the exact defect that put `globalThis.React` into eight consumers' harnesses.
    for (const [name, text] of [
      ['index.js', INDEX],
      ['charts.js', CHARTS],
    ] as const) {
      assert.match(text, /from "react\/jsx-runtime"/, `${name} does not import the jsx runtime`)
      assert.doesNotMatch(
        text,
        /\bReact\.createElement\b/,
        `${name} emits React.createElement, which needs a React global no consumer should install`,
      )
    }
  })

  it('ships no TypeScript and no unrewritten .ts specifier', () => {
    // `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` means the sources spell
    // their imports './surfaces.ts' and the emitter rewrites them to './surfaces.js'. If that ever
    // stopped, the published package would carry imports resolvable only under a TS loader.
    for (const file of readdirSync(DIST)) {
      if (file.endsWith('.d.ts')) continue // declarations are the types entry, not source
      assert.doesNotMatch(file, /\.tsx?$/, `dist/${file} is TypeScript`)
    }
    assert.doesNotMatch(INDEX, /from ["'][^"']+\.tsx?["']/, 'index.js imports a .ts specifier')
  })
})

describe('the committed build is the build of these sources', () => {
  const require = createRequire(import.meta.url)
  const tsc = join(dirname(require.resolve('typescript')), '..', 'bin', 'tsc')
  // Compiled BESIDE dist/ rather than into the OS temp directory, and that is load-bearing: a
  // source map's `sources` entry is relative to the map, so an output directory at a different
  // depth produces a different path for the same source and every .js.map "differs". Same depth,
  // same bytes, and the comparison measures the compiler rather than the geography.
  const out = mkdtempSync(join(PKG_ROOT, '.dist-check-'))
  after(() => rmSync(out, { recursive: true, force: true }))

  /**
   * The compiler's own complaint, kept, rather than thrown out of a `describe` body.
   *
   * `pnpm build` is not a step in this repository's CI — this rebuild is how the build gets run at
   * all. So a build that FAILS has to fail this file legibly. Letting `execFileSync` throw out of
   * the suite body does turn the run red, but it reports "the committed build is the build of
   * these sources" with a stack, and not the one line of `tsc` output that says what is wrong.
   */
  let buildError = ''
  try {
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.build.json', '--outDir', out], {
      cwd: PKG_ROOT,
      stdio: 'pipe',
    })
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: Buffer; stderr?: Buffer }
    buildError = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim() || String(e)
  }

  // FILES only. `dist/fonts/` is a directory of woff2 the build copies alongside the stylesheets;
  // including it here would make the set comparison below report a phantom emitted file, and
  // filtering it BY NAME would mean a second directory added tomorrow silently escapes every
  // assertion in this block. Directories are compared separately, below.
  const files = (dir: string): string[] =>
    readdirSync(dir)
      .filter((f) => statSync(join(dir, f)).isFile())
      .sort()
  const compiled = buildError === '' ? files(out) : []
  const committed = files(DIST)

  it('compiles at all — this is where CI runs the build', () => {
    assert.equal(buildError, '', `tsc -p tsconfig.build.json failed:\n${buildError}`)
  })

  it('compiled something, so a silent no-op build cannot pass this file', () => {
    assert.ok(compiled.length >= 10, `the rebuild produced ${compiled.length} files: ${compiled}`)
  })

  it('emits exactly the non-stylesheet files that are committed', () => {
    assert.deepEqual(
      compiled,
      committed.filter((f) => !f.endsWith('.css')),
      'dist/ holds a different set of emitted files than a fresh compile of src/ — run pnpm build',
    )
  })

  it('emits byte-identical content for every one of them', () => {
    const drifted = compiled.filter(
      (f) => readFileSync(join(out, f), 'utf8') !== readFileSync(join(DIST, f), 'utf8'),
    )
    assert.deepEqual(
      drifted,
      [],
      'the committed dist/ is not what src/ compiles to — run pnpm build and commit the result',
    )
  })

  it('carries every typeface in src, byte for byte, and no other', () => {
    /*
     * The fonts are BYTES, not compiler output, and they reach a consumer the same way the
     * stylesheets do: `dist/` is what every `exports` entry names and what every Dockerfile copies.
     * A woff2 edited in `src/fonts` and not rebuilt is exactly the staleness this file exists to
     * catch, and it is the one kind that would otherwise be invisible — a stale font does not fail
     * to parse, it renders the previous design.
     *
     * Derived from what is IN src/fonts rather than from a list, so a fourth face is covered the
     * day it is added instead of the day somebody remembers this file.
     */
    const wanted = files(join(SRC, 'fonts'))
    assert.ok(wanted.length >= 2, `src/fonts holds ${wanted.length} files`)
    assert.deepEqual(files(join(DIST, 'fonts')), wanted, 'dist/fonts differs from src/fonts — run pnpm build')
    const drifted = wanted.filter(
      (f) =>
        !readFileSync(join(SRC, 'fonts', f)).equals(readFileSync(join(DIST, 'fonts', f))),
    )
    assert.deepEqual(drifted, [], 'a typeface in dist/ differs from src/ — run pnpm build')
    // Every face the stylesheet asks for must be one of these files, or the page silently renders
    // in the fallback and the whole self-hosting argument in tokens.css is decorative.
    const css = readFileSync(join(SRC, 'tokens.css'), 'utf8')
    const referenced = [...css.matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map((m) => m[1] ?? '')
    assert.ok(referenced.length >= 2, `tokens.css references ${referenced.length} font files`)
    const missing = referenced.filter((f) => !wanted.includes(f))
    assert.deepEqual(missing, [], 'tokens.css @font-face names a file that is not in src/fonts')
  })

  it('carries every stylesheet in src, byte for byte, and no other', () => {
    // The build script copies the stylesheets rather than compiling them, so they are compared
    // separately. Derived from what is IN src rather than from a list here, so a third stylesheet
    // is covered the day it is added instead of the day somebody remembers this file.
    const wanted = files(SRC).filter((f) => f.endsWith('.css')).sort()
    assert.ok(wanted.length >= 2, `src has ${wanted.length} stylesheets`)
    assert.deepEqual(committed.filter((f) => f.endsWith('.css')), wanted)
    const drifted = wanted.filter(
      (f) => readFileSync(join(SRC, f), 'utf8') !== readFileSync(join(DIST, f), 'utf8'),
    )
    assert.deepEqual(drifted, [], 'a stylesheet in dist/ differs from src/ — run pnpm build')
  })
})

function existsRelative(target: string): boolean {
  try {
    readFileSync(join(PKG_ROOT, target))
    return true
  } catch {
    return false
  }
}
