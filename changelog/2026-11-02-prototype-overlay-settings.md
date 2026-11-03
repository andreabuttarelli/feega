# Prototype overlays: position, outside click, backdrop, Close overlay

From the mobile case study (2026-11-02), M18 and two minor findings.

- **Overlay settings.** `open_overlay` actions carry `overlay` (`position` center|top|bottom|manual,
  `x`/`y` for manual, `closeOutside`, `backdrop` `#rrggbbaa`) in `prototype/model.ts`, parsed with
  `prefault({})` so stored links read as centred, closing outside, black at 45%. Prototype panel
  (`PrototypeSection.svelte`) edits them through `reoverlaid`; re-aiming or retargeting a link keeps
  them (`retargeted`, `linkToFrame`).
- **Placement.** The overlay is now shown at its own size relative to the frame under it
  (`overlayBox`, `overlay-place.ts`), shrunk only if bigger. Before it was always centred at 80% of
  the stage, so a 390-wide sheet over a 390-wide phone never touched the edges.
- **Close overlay** action: closes the top overlay with the link's transition, never walks back
  through history (Back still does both).
- **Black wedges** on an overlay frame with rounded corners: the preview stage behind the frame is
  black; overlay sheets now render it transparent (`background` passed through `PlayerFrameView` →
  `CompositionPlayer` → `MotionPreview`) and the sheet no longer adds its own radius.
- **Hotspot stacking.** Hotspot buttons were emitted in track order (top layer first), so in the DOM
  the bottom layer's button covered the top one. `hotspotsOf` now emits bottom-first paint order
  with every parent before its children: the top layer and a child's own link win; a child without
  a link lets the click reach its parent.

The audit's "text over a linked card blocks the hotspot" turned out, in the harness log, to be a
tap that landed on the still-open overlay's scrim; the stacking fix covers the real case of
overlapping links.

Guards: `model.test.ts`, `player.test.ts`, `overlay-place.test.ts`, `edit.test.ts`,
`link-draft.test.ts`, `hotspots.test.ts`.

Not done: dragging the overlay on the canvas to set a manual position (X/Y fields only); no feature
video.
