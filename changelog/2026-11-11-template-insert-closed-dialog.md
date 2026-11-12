# Fix: "Insert at playhead" in the Templates dialog did nothing

`insertEntry` in `FrameDialogs.svelte` called `onclose()` first and read `doc` and `session` after.
Closing unmounts the dialog, its `session` prop turns null, and the next read threw
`Cannot read properties of null (reading 'history')` inside an async function: the dialog closed,
no clip landed, nothing was reported. The same read broke the "Add its sounds" follow-up.

`insertThenClose` (`src/lib/motion/template/insert-flow.ts`) now places the template and applies the
edit while the dialog is still mounted, then closes; a refused insert reaches the session notice
through the same edit. The sounds follow-up keeps the session it started with.
