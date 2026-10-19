# Empty frames are just their stage

An empty frame used to carry UI of its own: on the canvas a clapperboard icon with the format
label (`MotionNode.svelte`), in the editor a floating card with "Template…", "Add element" and
"Ask the agent" (`MotionEditorShell.svelte`, gated by `showsStart` in `motion/start-prompt.ts`).

Both are gone, with `start-prompt.ts` and its test. An empty frame is its black stage on the
default canvas, on `?renderer=core` (their frame faces already drew only the stage) and in the
editor.

No feature lost its only entry point: templates stay in the editor menu and the frame library,
Add stays in the toolbar, the agent stays in the chat column.
