# Code export: responsive layout and bundled images

An audit exported a URL-imported vercel.com page: layers were `position: absolute`
with pixel widths from the frame, so the project did not reflow, and images were
24 h signed Supabase links that died the next day.

- A frame without auto layout whose children stack top to bottom (no vertical
  overlap, pinned top/left) exports as a flex column with margins
  (`stackOrder`, `stackItemRules` in `codegen/place.ts`). Overlapping layers stay
  absolute.
- Widths of 320 px and more become `width: 100%` + `max-width` (containers) or
  `align-self: stretch` + `max-width` (stacked children); wide absolute layers
  pinned left get percentages.
- Breakpoint overrides already emitted `max-[N px]:` classes and media queries;
  a new test covers them on an auto-layout row.
- Images reference `/assets/<id>.<ext>` (React, Svelte) or `assets/…` (HTML).
  `CodeExport.assets` lists `{ path, ref, url }`; `zipCode`
  (`src/lib/canvas/code-zip.ts`) fetches each file into the zip and, when a
  fetch fails, rewrites that reference back to the URL. `feega motion code`
  does the same on disk.

Discarded: a server-side zip (the zip is built in the browser in
`DevCode.svelte`, which already holds the signed URLs); public bucket copies
(they would make private project assets public).
