# Frame inspector and selection colours

Selecting a frame alone left the right bar closed: the shell and the
tab router opened it only when an element *inside* the frame was
picked (`session.selection.length`). `FrameProperties.routed` now names
what the bar routes to (the frame, or the frame plus its picks), and
both the shell and `CanvasChatPanel` read it.

Selection colours moved from a per-selection list to counted uses over
a scope: the selected clips plus every comp they reach (groups,
precomps, nested). The frame inspector uses the whole frame as scope.
Recolouring is one doc edit, so one undo step through the normal save.

The multi-selection style section is now driven by the component
registry (`fieldsOf`): the Style fields every selected kind declares,
with simple controls only. It replaces the hand-kept `STYLE_PROPS`
list. Fills and strokes stay out (complex controls); their colours are
edited through selection colours. Keyframed colours are not scanned.
