# Download a node's result, in the format you pick

Every generation lived only on the canvas. Getting the actual file out meant opening the signed
asset URL and using the browser's own save dialog, which kept the original encoding and gave no
way to pick a lighter format.

## What changed

- `NodeDownload.svelte` is a single icon-button-plus-menu component, used on image and video
  `GenNode` results, `EffectsNode` and `CompositionNode` — shown only once the node has a
  `refId`. One component, not four copies, because "download what came out, in a chosen format"
  is the same action everywhere; only the format list changes with the medium.
- Images offer PNG, JPEG, WebP and the original bytes unconverted; AVIF appears only where
  `canvas.toBlob('image/avif')` actually returns an AVIF blob, feature-detected once and cached
  (`avif-support.ts`) — no static browser-sniffing list.
- Videos offer MP4 (the original bytes, no re-encode) and GIF. Composizione's export is already
  an MP4 (`avc1`, from `composition/encode.ts`), so it reuses the same two entries.
- MOV and WebM are left out. Composizione's own export only ever produces MP4 or, on the
  MediaRecorder fallback, WebM with an unpredictable codec — remuxing that into MOV, or renaming
  it, is not something this change verifies works in real players, so it doesn't offer to.
- The format table, filename builder and GIF size caps (`download.ts`) are pure and tested first;
  the actual encoding (`download-convert.ts`, canvas 2D re-encode for images, `gifenc` for GIF)
  is a dynamic import — a canvas that downloads nothing never pays for either.
- GIF export clamps to 640px width (scaled proportionally), 15fps and 10s, shown as the plan
  before it runs — uncapped, a short clip already produces a multi-hundred-MB file.
- Filenames are `<node type or its display name>-<6-char id>.<ext>`, slugified.
- Placed directly on each tile (top-right over the result), not the selection toolbar: it needs
  the node's medium and refId, which the tile already has and the toolbar would need re-deriving
  for a single-node action nothing else in that bar performs.

## Verification

`src/lib/canvas/download.test.ts` — format tables, filename builder, GIF plan clamping. Live in
Chrome against `/p/5ae78d0a-a983-418e-b646-c25478644dc0`: downloaded an image node as WebP
(`RIFF....WEBP` magic bytes) and PNG (`89504e47...`), a video node as MP4 (`....ftypisom`) and
GIF (`GIF89a`). AVIF correctly absent from the menu under the CDP-launched Chrome used for the
check, which doesn't encode AVIF from canvas.
