# The motion editor opens inside the canvas

**Before.** A motion node on the canvas was a preview with an "Open editor" link to
`/p/…/motion/<id>`, a separate page with its own state (~2250 lines in `+page.svelte`).

**Now.** Selecting one motion node edits it in place:

- The page's state and markup moved, unchanged, into `MotionEditorShell.svelte`
  (`loadEditorSession` for the data); the route is a thin wrapper, and
  `motion/[nodeId]/session` serves the same data as JSON to the canvas.
- `MOUNT` (`editor-mount.ts`) is the one table of what differs between page and canvas mounts:
  title, close, where the preview lives, who zooms, what the layout measures.
- The preview stays in the editor and is laid over the node body every frame
  (`anchoredTo`). Re-parenting it into the node reloaded its iframe blank.
- Keys and undo follow the region last touched (`key-region.svelte.ts`).
- `freeArea` + `DOCK_EDGE` compute the room the docked regions leave; `frameIn` centres the
  node in it.
- Canvas chrome is docked: one solid top bar, a left bar, left panels that push the canvas.
- Layers panel in the left bar: canvas nodes plus the open video's tracks and clips, editing
  through the same doc ops the agent uses (`set_track`, `move_clip`, `set_visibility`).
- Timeline: the name column narrows with the timeline's width (`headerPx`), and the first
  layout fits the whole video to the lanes (`fitZoom`), refitting until the user zooms.
- Phone: one bar on top while editing, other nodes hidden.

**Discarded.** A centred overlay preview (rejected by the user); a migration to reorder
canvas nodes in Layers (no stacking field; out of scope).

**Open.** On phone/tablet the title in the node can look soft in the live compositor frame
while a fresh capture of the same player is sharp; a `fixme` e2e measures it.
