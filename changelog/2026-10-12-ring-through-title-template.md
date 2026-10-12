# Ring through title motion template (draft)

Hand-built template from a reference: a huge lowercase title, then a
tilted ring of photo cards turns around it, in front of the letters on
the left and behind them on the right.

- Pure function of `t` (`RING_MODEL`), CSS only, shared `customTemplateDoc`,
  `word-entrance`, `media-list`; runtime vars use the `ring_` prefix.
- Depth: cards are projected in JS and stacked by z-index around the title
  layer, not by `preserve-3d` sorting. Cards swap sides only at the top and
  bottom of the ring, away from the letters (tested).
- Title is fitted to a share of the frame width by measuring it.
- Loop: title first, ring spins in with a decelerating lead, everything
  leaves at the end. Pure in-out expo, no overshoot.
