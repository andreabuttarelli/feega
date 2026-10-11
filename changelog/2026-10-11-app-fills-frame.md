# The app fills the frame, and the shots frame what matters

The 14-27 eval put the app on screen 50% of the film across 3 screens, but
small and dark: device-fly-in in portrait left the screen at ~25% of the
frame, ui-focus pulled back to a `WHOLE` view that fit the UI inside the
frame (26% in 9:16), and every shot sat on the black `paper`. The chatbot
also zoomed on "Motion editor" and "New video" because `recreate_ui` listed
elements in DOM order: sidebar first.

- **Coverage measured on what's drawn.** `shots/coverage.ts` models the
  UI rectangle on screen per shot and time; `coverage-drawn.test.ts`
  renders each UI shot in Chromium (9:16, 16:9, 1:1) and checks the model
  against the `.vui` bounding box within 0.1. The gate `small-ui`
  (blocking) samples 12 frames per library UI shot × clip scale²: under
  60% of the frame for most of the shot fails, except one device-fly-in
  or before-after per film. Plain recreated clips (not shots) are not
  measured yet.
- **Layouts.** ui-focus, ui-morph and whip-zoom clamp the camera so the UI
  always covers the frame (`filled`: k ≥ cover, centre clamped to the
  UI); views are clamped before interpolation — clamping per frame made
  the camera speed wobble, which the smoothness test flagged. Vertical
  device-fly-in zooms into the screen after landing.
- **Native background.** UI shots paint the root with the UI's own
  background (paper only when it is transparent).
- **Importance.** `vector-ui/importance.ts` ranks elements by role (input
  > button > stat/image/card > heading > text/link) and marks a left 18%
  column, right 6% and top 6% band as `nav`. `recreate_ui` returns
  elements in that order with `zone`, plus `focus` (top main ids).
  `add_shot` refuses nav targets unless `focus: "navigation"`.
- **Fidelity first.** `fidelity` / `low_fidelity` now follow `ok` in the
  `recreate_ui` output, so a truncated saved output still shows it.
  `ui-fidelity.browser.test.ts` runs the SSIM path in a real browser.

- **Smoothness.** Filling the frame made CI read camera kinks and text
  re-hinting as flicker. ui-focus now glides between views clamped once
  (no per-frame clamp, no cursor follow), `.cam` keeps its raster
  (`will-change: transform`), and the flicker detector counts a delta only
  above 25% of the local level.
- **v8 follow-ups.** Each parallel shot crew has its own look
  (`ownLook`): crew B is no longer held by crew A's frames. `recreate_ui`
  refuses a url already rebuilt under another name (v8: /app twice).

Discarded: a soft (smooth-max) clamp per frame and a temporal average of
the camera — both still wobbled.
