# Figma paste: decoded, not refused

Reverses the "stays on Copy as SVG" decision (`2026-10-23-figma-paste-decision.md`):
the condition it set — a real captured payload as fixture — is met
(`tests/fixtures/figma/clip-1.html`, the user's own "Cover" frame).

What the clipboard holds (verified on the capture): `(figmeta)` base64 JSON
(fileKey, pasteID, imageHashes) and `(figma)` base64 `fig-kiwi` archive: 8-byte
header, u32 version, then length-prefixed chunks. Chunk 1, the Kiwi schema, is raw
deflate; chunk 2, the data, is zstd. Both are sniffed by magic, so a switch of
either back and forth still decodes. Decoded with `kiwi-schema` and the schema in
the payload itself, so Figma schema changes are absorbed as long as field names hold.

Layers:
- `src/lib/canvas/figma/archive.ts` — html → message (pure, browser and server).
- `vector-network.ts` / `commands.ts` — `vectorNetworkBlob` (vertices, segments,
  regions with winding rule) and `commandsBlob` geometry → SVG path data.
- `scene.ts` — nodeChanges → our layer tree (frame / shape / text) plus a
  `skipped` list. Golden snapshot in `scene.test.ts`.
- `figma-doc.ts` — layer tree → MotionDoc clips (Shape paths, Text, Precomp
  groups for nested frames, effects).

Wiring: ⌘V on the canvas → `readPaste` (`Pasted.Figma` now carries the html) →
over a frame: `GpuFlow` `IN_FRAME` → `pastedInFrame` → `figmaIntoFrame`, one
group; on empty canvas: `+page.svelte` `pasteFigma` → action `pasteFigma`
(`canvas-page.ts`) → `pasteFigmaAt` (`move-element.ts`) → new frame node of the
copied size, named after the Figma frame. The skipped list shows in the canvas
banner (canvas paste only).

Kept out on purpose: auto layout is flattened to the positions Figma already
computed (reported); images become a grey placeholder with the hash reported
(no image bytes in the clipboard); instance overrides ignored; rotation of frames
and text reported, not applied. Only the top fill and first stroke are kept.
