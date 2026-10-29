# Import from code

Spec `docs/specs/code-import.md`, ADR 0028.

- New: a public GitHub React app runs in a Vercel Sandbox; one route is read like URL import, and
  each element rooted by a component of the repo (React fiber, name declared in the repo) becomes
  a main or an instance. Props: lowercase symbols and booleans are variant axes, strings are text
  properties and overrides.
- Figma importer: code mains carry `set`/`variant` (as URL import's repeated blocks) and text
  `properties`; `instance-diff` now also accepts text changes inside nested comps as nested
  overrides; geometry differences of a text or of the auto layout container itself are
  overrides too (layout reflows them); an instance build no longer leaks the mains it made into
  the page's main table.
- `urlPlan` takes the marker: `repeatedOf` by default, code components for code import.
- Codegen variant sets and the render/import fixes this needed: `changelog/2026-10-29-variant-set-export.md`.
- Discarded: static parsing (no layout), a Babel/SWC plugin (one per bundler, edits the user's
  build), running the repo on our functions.
- Measured on shadcn-admin `/`: 40 components, 43 variants, 13 instances; SSIM 0.426, equal to the
  same page without components. Run: `CODE_IMPORT_FIDELITY=1 npx vitest run src/lib/server/code-import`.
