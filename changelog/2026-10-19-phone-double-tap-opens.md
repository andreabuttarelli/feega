# A double tap opens a frame on a phone (GPU canvas)

#814 removed the "Open editor" pill: opening became double-click / double-tap, wired through
`MotionNode`'s `dblclick` → `onenter` → `requestMotion`. On the GPU canvas an unselected frame
is a GPU stand-in; the first tap selects it and mounts its `.gpu-dom-node`, and the second tap
lands on that wrapper, not inside `MotionNode` — so only `GpuFlow.onDouble` saw the double
click, and it only asked the frame to drill. On desktop that was enough (the editor opens on
select); on a phone (`Opening.OnRequest`) nothing asked to open. Failing since #814:
`phone-top-bar`, the frame half of `phone-bottom-stack`, `phone-side-sheet`.

Fix: `GpuFlow.onDouble` also calls `onNodeDoubled`, which the canvas page wires to
`requestMotion`, the same call `MotionNode` makes.

Still red after this, not fixed here: `phone-side-sheet` (d) taps the stage expecting an inner
element selected (since #814 that takes a double tap, and the sheet then covers the selection
by ~65 px — likely `REFRAME[Phone] = Stay` from #814); `phone-bottom-stack` "Design brings the
bar back" finds no visible add bar; `canvas-motion-open:83` neighbour labels.
