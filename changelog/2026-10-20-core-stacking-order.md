# Core canvas: nodes are drawn in the canvas stacking order

`standIns` listed every frame and then every card, so the core drew all cards over all frames. A
free element or frame placed above an opaque card in the canvas vanished behind it (the purple
rectangle over a generate card on b5a892f3: drawn by the classic canvas, absent in the core).

`CoreFrames` takes `order` (the canvas' own `placed` order) and sorts stand-ins by it; uses are
sent in that order. Reproduced by screenshot on b5a892f3, fixed by the same screenshot.
