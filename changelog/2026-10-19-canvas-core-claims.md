# `?renderer=core`: Pixi stops loading what the core draws

#953 dropped a poster after the core had drawn its node; until then Pixi had already fetched,
decoded and uploaded it, the html-to-image queue still captured core cards, and stored previews
were still uploaded. Now `claimedByCore` decides it up front: with the core on, every
non-DOM node card and every frame the core has not refused belongs to the core from
the first frame. Pixi gets a hidden blank face for it; snapshot preload, capture, upload and the
poster shelf skip it; the reveal waits for the core to have drawn it. `CoreFrames` reports
refused frames (source failed, partial list); frames with no head revision are refused too, so
they keep Pixi's poster.

`CoreFrames.onready` writes only when the sets change: writing a fresh set each time looped
(`effect_update_depth_exceeded`) once the cards depended on the refused set.

The core hands back three kinds of node, and Pixi loads those as before: frames with parts it
cannot draw (15/57 Chrome, 13/36 iPhone), nodes over its texture budget (`resident`: 13 on
Chrome at fit), and cards whose images did not load (6 image cards and a video on the heavy
copy point at assets that answer 404).

Heavy copy, `scripts/bench/canvas-core.ts` (now also full-paint time, Pixi counters, image
requests, preview uploads), `?renderer=core`, dev at 5cbaa4b before → after:

| | Chrome before | Chrome after | iPhone before | iPhone after |
|---|---|---|---|---|
| Pixi textures | 237 MB | 149 MB | 40 MB | 5 MB |
| Pixi fetches / uploads | 106 / 46 | 66 / 31 | 55 / 46 | 19 / 24 |
| html-to-image captures | 3 | 3 | 0 | 0 |
| preview uploads | 1 | 2 | 0 | 0 |
| browser RSS idle | 1709 MB | 1622 MB | 1687 MB | 1748 MB |
| full paint | 8.2 s | 16.8 s | 8.8 s | 8.4 s |
| pan fps | 33 | 33 | 39 | 41 |

Full paint on Chrome doubles: a node handed back is loaded by Pixi only after the core has
loaded its doc or images and refused it, one after the other. Before, Pixi loaded everything in
parallel and the reveal did not wait for the core. The fix is fewer refusals (ADR 0020 steps A
and B), not an earlier Pixi load. Full paint is floored by the bench's 8 s cookie wait. Load
4–8 during runs.

Plan for the default flip and the deletions: ADR 0020, "Flipping the default, then deleting".
