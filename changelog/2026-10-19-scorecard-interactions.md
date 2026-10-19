# Scorecard covers the rest of the canvas

New steps: deselect, insert a Generate text / image / video node, context menu, layers panel,
frame drag, inspector fields, Design / Motion switch, ungroup, delete, and a landing frame
(select, open, edit X, restore it — the copy's nodes are not ours to change). Open and reopen
start from a known motion frame (`FLUID_FRAME`), the landing from `FLUID_LANDING`; layer
picking tries the first twelve timeline rows, since a 270-clip landing virtualises the rest.

`inline-editor-open.spec.ts` times canvas → inline editor: pointerdown to stage painted and to
timeline rows present, cold / warm (another frame) / reopen. `FLUID_PROFILE=<step prefix>`
writes a CPU profile of that step next to the scorecard.

Still undriven: frame fill and the group's rotate handle. The Properties tab stacks the
inspector of every editor opened earlier in the session, and clicks land on a stale one.
