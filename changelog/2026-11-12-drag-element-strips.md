# Canvas: auto-layout strips hide while an element is dragged

Dragging a selected auto-layout container recomputed its padding and gap strips on every
pointer move. The strips read `withAutoLayout` of the whole frame, cached per doc, and a drag
makes a new doc each move: on the landings fixture that was the largest share of main-thread
JS in the element-drag profile (~0.7 s of 4 s, unthrottled).

`FrameGesture` joins the frame-tools context; the auto-layout rule shows the strips only when
the frame is idle. GpuFlow passes `Dragging` while `frameGuides` belongs to the frame. The
strips come back on release.
