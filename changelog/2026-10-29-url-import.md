# Import from URL

Spec `docs/specs/url-import.md`, ADR 0026.

- New: a public page becomes an editable frame. `pageTreeOf` reads the DOM in a `liveBrowser`
  tab as Figma REST nodes; `urlPlan` sends them through the Figma importer.
- Discarded: a new Chromium function or Vercel Sandbox (build size, cost); a second converter
  next to the Figma one.
- Figma scene: text with `textAutoResize: HEIGHT` now lands as auto-height (wraps) instead of
  auto-width. Figma clipboard pastes do not carry the field, so they are unchanged.
- Fidelity (SSIM above the fold, `URL_IMPORT_FIDELITY=1 npx vitest run src/lib/server/url-import`):
  linear 0.77, stripe 0.59, vercel 0.91.
