# Create formats

Frame menu item "Create formats…" opens a picker (1:1, 4:5, 9:16, 16:9, custom
w×h). `createFormats` (server, `FrameStore`) reads the frame, runs `reformat` per
target and creates each copy as a new frame in a row to its right; undo deletes them.

`reformat` (pure): full-bleed layers (≥95% both ways) keep covering; everything else
scales uniformly to fit around the centre, so nothing stretches: box, transform
offsets, width/height/size keyframes, text size (fraction of the short side) and
auto layout px. Discarded: per-element smart re-layout (needs product rules).
Parity: `create_formats` canvas op (MCP + chat via canvas_tool). Real-stack e2e.
