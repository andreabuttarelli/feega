# `?renderer=core` stops leaning on Pixi for frames, cards and overlays

Phase 3 of ADR 0020 removes, behind the flag, what the core canvas still borrowed from the old
renderer:

- html-to-image card snapshots and stored-preview lookups are off on `?renderer=core`: every
  card is drawn by the core or handed to the DOM.
- The pending wire, the pointer-hover ring and running rings move into the core overlay.
- A frame the core cannot draw whole goes to the core as its poster, contained on the black stage
  like its card, so Pixi draws no frame at all there (57/57 frames handed over on the heavy copy,
  15 of them as posters).

Still on Pixi with the flag: the scene object itself (reveal gate, fit-on-load, backend badge,
context-loss recovery), cards handed to the DOM while edited. Next: run the core canvas without
creating a Pixi scene, then flip the default with `?renderer=gpu` as the escape.
