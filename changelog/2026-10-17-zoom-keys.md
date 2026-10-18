# Figma zoom keys ⇧0 / ⇧1 / ⇧2

Figma (help.figma.com/hc/en-us/articles/360041065034): ⇧0 100%, ⇧1 fit, ⇧2 selection.
Canvas: `canvas/shortcuts.ts` matches by `e.code` (Digit0–2) because ⇧ changes `e.key`
per layout. Frame: `motion/shortcuts.ts` resolves Digit codes like letter codes;
`zoomToBox`/`boxAround` in `preview-view.ts` frame the selection. Old `0`, ⌘0, ⌘1 kept.
The GPU renderer (`GpuFlow`) must add `zoom-actual`/`zoom-selection` to its key table on
merge: its `Record<CanvasCommand['id']>` fails the type check until it does.
