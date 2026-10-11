# Cursor in ui-focus and ui-morph shots

Feedback: "the cursor and clicks in the UI are missing". The shots pressed and typed with no
pointer on screen.

- `src/lib/motion/shots/cursor.ts`: the `cursor` slot contract (`CURSOR_SLOT`, `CURSOR_GUIDE`:
  `[{ target, action: move|hover|click|type|scroll, text?, at? }]`) and `cursorMath()`, a pure
  planner + pose of `t`, serialized into the shot JS like `springMath` so tests and render run the
  same code. Auto script from element roles (input → type, button/link/icon → click, else hover).
- Motion: curved path, in-out expo glide, small overshoot settled before the click (an overshoot
  after arrival tripped the flicker check), press scale + ripple, I-beam on inputs, hand on links,
  hover brightness faded in/out, typing at 14 cps, scroll under a still cursor.
- ui-focus camera now follows the script steps instead of fixed times; ui-morph's ring and swap
  follow the click on `to_id`. Both nudge the camera toward the cursor.
- `add_shot` takes the array (stored as a JSON string prop, editable), validates targets;
  `list_shots` returns the guide. CLI/MCP reach it via `ask_motion_agent`.
- Not built: click sound — the motion doc has no SFX library to align a clip from.
- Residual: an expo-out camera stop on the button beat in 9:16 ui-focus is flagged by
  `motion-smoothness` (the previous ui-focus had similar jolts).
