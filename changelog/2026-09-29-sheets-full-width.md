# Canvas sheets full width, again

Calendar/Ads/Settings sheets rendered 384px wide at x=0 on desktop
(measured on a production build at 1440 and 1280, every entry point).

Cause: tailwind is imported with `important`, so the primitive's
`data-[side=left]:left-0` / `sm:max-w-sm` / `w-3/4` are `!important` in
`@layer utilities`, specificity 0,2,0 — the same as
`[data-slot=sheet-content].canvas-sheet`. The tie was settled by which
stylesheet loaded last; after later merges the tailwind chunk won.

Fix: the selector adds `[data-side]` (0,3,0), so it wins regardless of
chunk order. `canvas-sheet-layout.test.ts` now fails if any
`.canvas-sheet` selector drops back to the primitive's specificity.
`tests/e2e/shell.spec.ts` never ran in CI (skipped without
`E2E_REAL_STACK`), which is why the first regression guard missed it.
