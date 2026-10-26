# Inline text editor anchored to the laid box

The inline editor of a vertically centred text set its offset from the first
height it measured (`laid ??= content`). When that first measure was one line
of a two-line headline, the editor opened ~50 px above the drawn text, over the
layer above it (seen on the Aurel landing headline while recording the landing
video).

The offset now comes from the laid box height the GPU layout reports:
`anchorShift(layout, content) = (layout.height - content) * layout.vertical`,
in `frame-text-edit.ts`, tested there. A component test with jsdom was tried
and dropped: `onMount` resolves to the server build under vitest.
