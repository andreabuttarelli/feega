# `?renderer=core`: Pixi stops loading what the core draws

#953 dropped a poster after the core had drawn its node; until then Pixi had already fetched,
decoded and uploaded it, the html-to-image queue still captured core cards, and stored previews
were still uploaded. Now `claimedByCore` decides it up front: with the core on, every
unrotated, non-DOM node card and every frame the core has not refused belongs to the core from
the first frame. Pixi gets a hidden blank face for it; snapshot preload, capture, upload and the
poster shelf skip it; the reveal waits for the core to have drawn it. `CoreFrames` reports
refused frames (source failed, partial list); frames with no head revision are refused too, so
they keep Pixi's poster.

`CoreFrames.onready` writes only when the sets change: writing a fresh set each time looped
(`effect_update_depth_exceeded`) once the cards depended on the refused set.

Heavy copy, `scripts/bench/canvas-core.ts` (now also full-paint time, Pixi counters, image
requests, preview uploads):

| | Chrome before | Chrome after | iPhone before | iPhone after |
|---|---|---|---|---|
| Pixi textures | 239 MB | 12 MB | 40 MB | 5 MB |
| Pixi fetches / uploads | 102 / 57 | 34 / 35 | 53 / 50 | 20 / 21 |
| html-to-image captures | 3 | 0–1 | 0 | 0 |
| preview uploads | 1 | 0 | 0 | 0 |
| browser RSS idle | 1734–1769 MB | 1615–1786 MB | 1736–1868 MB | 1051–1469 MB |
| full paint | 8.1–9.1 s | 8.1 s | 8.2–8.8 s | 8.1–9.0 s |

Full paint is floored by the bench's 8 s cookie-banner wait; it says "not slower", not a speed.
Browser RSS is dominated by the core and the DOM, not Pixi. Noisy machine (load 4–8).

Plan for the default flip and the deletions: ADR 0020, "Flipping the default, then deleting".
