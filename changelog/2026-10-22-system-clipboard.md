# System clipboard and per-element export on the GPU canvas

Workstream C of the Figma gap audit (#7, #29).

Before: ⌘C/⌘V lived in page memory (`element-clipboard.svelte.ts`, the page's
`clipboard`), so nothing crossed tabs, reloads or apps, and nothing from outside
(SVG, image, text, Figma) could be pasted. ⌘C on an element picked inside a frame
copied the frame tile. Export was frame-level, StillExport stopped at 2×.

Now:
- ⌘C/⌘X write the clipboard as `text/html` carrying a base64 JSON payload
  (`system-clipboard.ts`): tiles, or elements picked inside a frame. Written both
  by the `copy` event and `navigator.clipboard.write`, since the keydown path may
  not produce a native event.
- ⌘V is the native `paste` event (the shortcut no longer prevents default and no
  longer pastes from memory). `readPaste` picks: feega payload → SVG markup or
  file → image file → Figma marker → plain text. The context-menu Paste reads
  `navigator.clipboard.read()`.
- SVG: `svg-import.ts` is a regex parser (no DOM in tests): path (all commands,
  arcs to cubics), rect, circle, ellipse, line, poly*, nested `transform`, viewBox,
  fill/stroke from attributes or style. Each shape is a pen element with its
  colour (`drawnSchema` pen gained `fill`/`stroke`), grouped, which merges them
  into one group element. Ignored: gradients, rounded `rx`, clip paths, text.
- Image → the existing upload path, at the cursor. Text → a text element
  (`drawnSchema` box gained `text`).
- Paste lands at the pointer; over a frame, SVG shapes and text move into it.
- Figma: its clipboard is a compressed Kiwi binary of a private schema; decoding
  it was judged not worth it. Pasting it shows how to use "Copy as SVG".
- Export: presets 1×/2×/3×/4×/SVG in `ExportRows`; elements picked inside a frame
  export through `exportSelection` `elements`; free elements open the multi-row
  dialog (SVG available); StillExport scales go to 4×.

Not done: images pasted over a frame stay on the canvas (`moveFree` reads motion
docs only).
