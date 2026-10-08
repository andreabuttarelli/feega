# Canvas motion delegation: open canvas, light frames, motion-capable model

Follow-ups to #283.

- **Open canvas.** `create_motion_video` put every video on the "Motion" canvas. The canvas chat
  now sends `canvasId` (route param) in the turn body; the endpoint keeps it only if it belongs to
  the project and the delegation uses it as default. No canvas open → "Motion" canvas, as before.
  Other `startMotion` callers already pass their canvas (remix, `/app/motion` form) or have none
  (`/app` home).
- **Frames out of `chat_messages`.** `view_motion_frames` returned up to 6 base64 JPEGs, saved
  verbatim in `tool_calls`. Frames now go to `canvas-assets` under
  `<org>/<project>/motion-frames/<node>/view-<callId>/` and the saved output carries `{ time, path }`.
  The model still gets the images in-turn: `toModelOutput` reads them from a per-call map.
  The motion agent's own `view_frames` (editor or server fallback) never put bytes in its output —
  frames travel through the session map — so nothing changed there.
- **Model guard.** `openrouter/auto` never finished in 6 minutes, `mistral-nemo` made a text node.
  `MOTION_CAPABLE_MODELS` (next to the chat catalogue) lists models that drive the motion tools;
  `askMotion` uses the asked model only if listed, else the default (Opus 5.5 low). The delegation
  result carries `model` and `model_note` when it fell back. MCP `/ask` already ran on the default.
