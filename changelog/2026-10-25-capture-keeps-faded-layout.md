# Browser render keeps faded boxes in the layout; reflow check for components

Signal: the CTA of the code-component video jumped upward twice (frames 208
and 217) as the button and the line under it faded in. The component only
tweened scale and opacity; the editor preview was still.

Cause: the capture clones the DOM into an SVG and skipped every node at
opacity 0 (`unseen`, meant for faded media). A skipped box in a centred flex
column leaves the clone, so the column re-centres in the export only, and
snaps back when the box reaches opacity > 0.

Fix: `unseen` skips a faded node only when it is out of the flow
(position absolute/fixed). In-flow faded boxes stay in the clone, invisible.

Systemic: the component check (`runCheck`) now asks the capture for the
layout boxes of every block element (`boxes`, offset geometry, unaffected by
transforms) and `reflowProblems` flags a box that moves while neither it nor
an ancestor changed a layout style. The motion prompt tells agents to animate
entrances with transform, opacity or clip-path only. The check reads the live
DOM, so it catches reflow a component causes; this renderer bug it would not
have seen, which is why the renderer is fixed too.
