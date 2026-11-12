# Tailwind 3: resolved config to tokens (pure half, not wired)

Spec: `docs/specs/design-system-import.md`, stage 4 (Tailwind v3 config).

`tailwind3.ts` turns a resolved Tailwind 3 config (the JSON `resolveConfig` returns) into the
same `Declared` entries a Tailwind 4 `@theme` gives (`--color-*`, `--spacing-*`, `--radius*`,
`--font-*`, `--text-*` with `--line-height` as `calc(lh / size)`, `--shadow-*`,
`--breakpoint-*`), and into the class → token map (`bg-primary` → `--color-primary`,
`rounded` → `--radius`). Because the names match v4, variables, styles and class evidence need
nothing new. Not wired: the config is code and must run in the sandbox
(`sandbox-runner.ts`, being rewritten elsewhere). The hook it needs: after install, run
`node -e` with `tailwindcss/resolveConfig` on the repo's config, print JSON (1 MB cap), schema-check,
and pass it with the config path to `designOf`, which appends `configTokens(json, path)` to the
parsed declarations. Origins point at line 1 of the config: write-back of v3 values (TS parser)
is not built, so these tokens must be treated as read-only when wired.
