# Product trailers are mostly the real app, at native colours, checked against the page

Eval `2026-10-11T14-04-23` reached the signed-in app but showed it ~3 s out of 29, dimmed,
as one sidebar; v5 tinted the editor into a negative and scaled title clips down.

- Gate (`direction.ts`): in a story film, `little-ui` blocks when recreated UI covers < 50%
  of the frames; `one-screen` blocks with fewer than 2 distinct screens (distinct vector
  JSON); `recoloured-ui` blocks colour effects (brightness, hue, tint, curves, b/w, LUT,
  levels, lift-gamma-gain) on a real-UI clip; `shrunk-ui` blocks scale < 90%. The same
  `uiRecolour`/`uiShrink` refuse `add_effect`, `set_lut`, `set_transform` up front.
- Director guide (`style.ts`): the share, the 2–3 screens, native colours, short cards.
- Fidelity: `vectorCapture` screenshots the page before reading it, paints the vector UI
  in the same tab (`AppTab.paint`) and scores SSIM (8×8 windows on 320×200 grey,
  `web/ui-fidelity.ts`). Under 0.85 it reloads, waits twice as long, reads again, keeps the
  closer read. recreate_ui returns `fidelity` and `low_fidelity` when still under.

Discarded: SSIM via ffmpeg (not on Vercel); a per-screen minimum time (share + count
covers the eval's failure).
