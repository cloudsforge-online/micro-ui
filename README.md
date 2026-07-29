# cloudsforge-ui

The workspace that publishes [`@cloudsforge/ui`](packages/ui) — the CloudsForge design system.

One package, because the tokens, the chrome, the surface registry and the chart primitives are
one decision each and splitting them would let them drift apart again. That is exactly what
happened to the version this supersedes: the accents lived in `@cloudsforge/ui/tokens.css`, the
registry lived in `@cloudsforge/shared/products`, and the two had already disagreed about Admin.

```
pnpm install && pnpm check && pnpm build
```

Specification: `docs/ecosystem/assets/design-system.md` and
`docs/ecosystem/assets/chart-palette.md`.
