# Motion critic: an independent review of the full cut

First step of "a studio, not a prompt". The motion turn now declares a roster
(`src/lib/server/motion/studio-roster.ts`: role, ai_calls label, share of
`AGENT_TURN_CAP_USD`) with two roles that actually run:

- **Builder** — the existing agent, now stopped at 88% of the turn cap.
- **Critic** — after the gate loop, a separate structured call on the vision
  model sees ONE contact sheet tiled from a frame every second of the whole
  video (max 24, `sheetTimes`), the brief/script, and the references the
  builder looked at. It returns a 1–10 score and at most six timed fixes.
  Below 8 with fixes, one bounded self-check round applies them. Logged as
  `motion-critic` in `ai_calls`, so cost per role is a group-by on `label`.

Before: the only look before delivery was `keyFrameTimes` (4 scene
midpoints) judged by the same model that built the video.

Discarded for now: Director/Researcher/Sound/Shot-builder sub-agents with
parallel shot builds. Declaring roles that do not run would be a table that
lies; they enter the roster when they are wired.
