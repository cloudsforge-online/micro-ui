# Typefaces shipped in `@cloudsforge/ui`

Three variable faces, self-hosted. `tokens.css` records *why* they are hosted here rather than
linked from a CDN and why each was chosen; this file records *what* is here, where it came from,
and under what licence — because a repository that ships font binaries and cannot say either is a
repository with an unresolved licence question in it.

All three are licensed under the **SIL Open Font License, Version 1.1**, whose full text is in
`OFL.txt` beside this file. The OFL permits bundling and redistribution, including in a commercial
product, and requires only that the licence travel with the fonts and that the reserved font names
are not used for a modified version. Neither file here is modified: each is the byte-for-byte
`woff2` Google Fonts serves for the corresponding unicode range, so no renaming obligation arises.

| Role | Family | Version | Axes | Copyright |
| --- | --- | --- | --- | --- |
| display | Bricolage Grotesque | v9 | `opsz` 12–96, `wdth` 75–100, `wght` 200–800 | Copyright 2022 The Bricolage Project Authors (https://github.com/ateliertriay/bricolage) |
| body / UI | Archivo | v25 | `wght` 100–900 | Copyright 2020 The Archivo Project Authors (https://github.com/Omnibus-Type/Archivo) |
| data / mono | Spline Sans Mono | v13 | `wght` 300–700 | Copyright 2021 The Spline Sans Mono Project Authors (https://github.com/SorkinType/SplineSansMono) |

## The files

Two per family: the `latin` subset, and `latin-ext` for the accented characters a European
customer's own name needs. Vietnamese, Cyrillic and Greek subsets exist upstream and are
deliberately **not** shipped — the estate serves `en-GB` only, and 200 KB of glyphs nobody renders
is 200 KB every surface in the estate pays for. Add the subset the day a locale needs it; the
`unicode-range` mechanism means doing so requires no change to any consumer.

    bricolage-grotesque-latin.woff2       128 KB
    bricolage-grotesque-latin-ext.woff2    52 KB
    archivo-latin.woff2                    34 KB
    archivo-latin-ext.woff2                32 KB
    spline-sans-mono-latin.woff2           36 KB
    spline-sans-mono-latin-ext.woff2       20 KB

Body copy costs two of those requests. The display face is not fetched at all until a rule asks
for `--cf-font-display`, because `@font-face` is lazy — so an operator dashboard that sets no
display type never downloads Bricolage.

## Replacing or updating one

`src/dist.test.ts` compares `src/fonts` with `dist/fonts` byte for byte on every run and fails if
they differ, and it reads the `url()` values out of `tokens.css` and fails if a `@font-face` names
a file that is not here. So: replace the bytes, run `pnpm build`, commit both directories. A stale
font does not fail to parse — it silently renders the previous design, which is the one kind of
staleness a build cannot otherwise notice.
