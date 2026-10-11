# Cursor shots: zero jumps, UI-scaled cursor, click sounds

- `cursor-smoothness.test.ts` renders ui-focus, ui-morph and a scripted ui-focus in Playwright
  Chromium at 9:16, 16:9 and 1:1 (real sizes, CDP capture at 0.5) and runs `motionJolts` on the
  frame diffs. It reproduced the reported stop/pop/flicker before the fix.
- Causes found: expo camera ease ending in blank space, camera follow weighted by a second bell,
  bells of arrival/dim/cursor out of phase, page dim release re-rasterising in steps, overshoot
  that stopped and restarted, element press spring too fast. Fixes: one in-out ease (`glide`) for
  camera, ring, hover and cursor; constant follow; camera beats lead the cursor (≤0.9 s); wider
  context around small targets; overshoot folded into the arrival curve; press as a 0.26 s bump;
  ui-focus no longer dims the page; typed glyphs fade in per character, caret fades while typing.
- Cursor size = 22 UI px × camera zoom, clamped to 3–11 % of the short side; motion blur by speed.
- Auto cursor script moved to TS (`AUTO_CURSOR`, `shotCursor`); `add_shot` always stores it.
- SFX: `scripts/sfx/build-sfx.sh` synthesises click/key/whoosh (CC0, 1–5 KB) into
  `src/lib/motion/sfx/`. `add_shot sound: on` lays a click per click/type and a key tap per
  character on an "SFX" audio track; `laySfx` uploads each sound once per session as a project
  asset. Whoosh is bundled for the Sound role, not placed yet.
