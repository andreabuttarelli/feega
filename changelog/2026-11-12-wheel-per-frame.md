# Canvas: wheel zoom and pan land once per frame

Each wheel event assigned the camera, and every assignment reran the camera's derived state
(overlay, culling, the core patch) before the next event. A fast trackpad or a mouse wheel can
deliver several events per frame; the budget bench, firing wheels unpaced, saw 14–16% of
heavy-canvas zoom frames over 11.1 ms against ~1% at one wheel per frame.

Wheel events now queue their zoom or pan in a `WheelBatch`; one animation frame applies them in
order and assigns the camera once. The result equals applying them one by one.
