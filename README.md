# cloudsforge-ui

[![ci](https://github.com/cloudsforge-online/micro-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/cloudsforge-online/micro-ui/actions/workflows/ci.yml) [![TypeScript](https://img.shields.io/badge/TypeScript-strict%20ESM-3178C6?logo=typescript&logoColor=white)](./tsconfig.base.json) [![node](https://img.shields.io/badge/node-%3E%3D22-5FA04E?logo=nodedotjs&logoColor=white)](./package.json)

The workspace that publishes [`@cloudsforge/ui`](packages/ui) — the CloudsForge design system.

One package, because the tokens, the chrome, the surface registry and the chart primitives are
one decision each and splitting them would let them drift apart again. That is exactly what
happened to the version this supersedes: the accents lived in `@cloudsforge/ui/tokens.css`, the
registry lived in `@cloudsforge/shared/products`, and the two had already disagreed about Admin.

```
pnpm install && pnpm check && pnpm build
```

**`packages/ui/dist` is committed.** Every consumer resolves this package through
`link:../ui/packages/ui` and none of them runs a build here, so committed output is the only shape
in which a built artefact reaches them. `pnpm check` recompiles the sources and fails if the
committed bytes are not their output — see `packages/ui/README.md`, "Why the build output is in
git".

Design authority: [`ecosystem/assets/design-system.md`](https://github.com/cloudsforge-online/micro-docs/blob/main/ecosystem/assets/design-system.md) and
[`ecosystem/assets/chart-palette.md`](https://github.com/cloudsforge-online/micro-docs/blob/main/ecosystem/assets/chart-palette.md).

---

## Provenance

The code in this repository was written by **Claude Opus 5** and **Claude Fable 5**, assets
generated with **FLUX 2 Pro**, under human direction and review.
