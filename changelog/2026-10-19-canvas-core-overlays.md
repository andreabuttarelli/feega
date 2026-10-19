# Canvas overlays in the core

On `?renderer=core` the world overlay (`world-overlay.ts`: wires with plain/linked/iterate looks,
marquee, snap guides, peers' outlines and cursors with names, the rotate knob) goes into the core
screen list through the camera. Their old renderers step aside on that path: SVG wires hidden,
Pixi marquee off, DOM guides and peer layer emptied, the DOM rotate button transparent but still
taking the drag. Hit-testing stays in TS.

Kept DOM: a peer mid cursor-chat (the bubble is multi-line text input from others), and the knob
of a rotated tile (the core draws it unrotated).

A transparent doc on a Frame now shows on the black stage the Frame card always drew; elements
and groups stay see-through.

Parity (`scripts/bench/canvas-core-parity.ts`, Chrome, heavy copy): fit 0.76% pixels off by
>8/255, every landing at two zooms 0.00% — the landings still keep their posters (custom
components unread), so that number measures the hand-off, not the engine.
