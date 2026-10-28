# Export a frame as code

First step of the code ↔ design ↔ motion program: a frame becomes a multi-file project (React + Tailwind, HTML + CSS, SvelteKit). Static only.

- `packages/motion-core/src/motion/codegen/`: pure doc → IR (`build.ts`) → target project (`targets/*`), one `TARGETS` registry in `index.ts`. No app imports.
- Dev mode's CSS module moved here unchanged (`codegen/dev-css.ts`) so package and app share one home; the codegen painters are richer (gradients, borders, shadows, flex/grid) and dev mode can switch to them later.
- Auto layout → flex/grid; absolute only for frames without auto layout or `layoutItem.absolute`, pinned by `constraints`. Fixed widths from 320 px become `width: 100%; max-width`.
- Components: one file per comp; props are the inner values (text, image, colour, visibility) that differ between instances. Colour props have no default: the class carries the design value, the prop overrides inline.
- Tokens: colours named by role (background, foreground, muted, surface, border, accent by saturation), colour variables and brand colours by name; fonts, radii, spacing.
- Engine fix, own commit: auto layout sized an instance as the whole frame (a Precomp has no box) and wrote props its schema rejects. Instances now take their component's bounds and move via `transform` x/y (`compBounds` in `layout/resolve.ts`).
- Wiring: frame **…** menu → `Export code…` (`FrameDialog.Code`) → `CodeExport.svelte` (client-side export, CodeMirror preview, `fflate` zip). `GET /api/v1/motion/[nodeId]/code` → `frameCode` (`server/motion/code-export.ts`), CLI `feega motion code`, MCP `export_code`.

Discarded: generating on the server only (the dialog would wait on a round trip for a pure function); a `ul` tag for layers named list/menu (children are not `li`); passing nested instance overrides down (needs a prop-drilling model; noted in docs).
