# Drag several layers in the Layers panel

Dragging a picked row used to move only that row. When it belongs to a multi-selection the
whole block moves (`dropLayers`): the rows are ordered by the panel order, so click order does
not matter, and they land above/below/into the target keeping their inner order. The drop is
one `video.edit`, one undo step. Dropping onto a row of the block does nothing.
Tests: `layers.test.ts`.
