# Canvas ↔ inline editor transition

- Desktop no longer zooms or centres the canvas when a frame opens; tablet and phone still frame it (`REFRAME` by viewport in `inline-motion.ts`).
- The add bar sits flush at the bottom centre on every viewport (phone was left-aligned with a gap). While a frame is edited it slides out with an in-out expo curve (`--ease-expo`, `--chrome-move` in `app.css`) and returns on close (`ADD_BAR` table); its `data-dock` drops so the free area ignores it. Reduced motion: no transition.
- The canvas editor timeline rises with the same curve.
- Default timeline height: 210 desktop, 180 tablet, ≤ 30% of a phone screen (`defaultTimelinePx`); a stored size still wins. Was 360.
- Add bar "Frame templates" opens the component library with the Video/Still switch; the pick becomes a Frame at the view centre through `frame_template` → `startFromTemplate(at)` → `startMotion(at)`.

Discarded for now: one persistent right panel for canvas and editor. Portalling the editor's side column into the canvas chat pane worked for identity and width, but the frame's player then showed only its background in Chromium; cause not found, and seeded e2e on production was stopped, so it was pulled.
