# `canvas_load_timing`: real load times from real devices

An iPad user reported a canvas taking seconds to open and PostHog had nothing to check it
against (`$web_vitals` is off, `frame_open_timing` covers the editor only).

The GPU canvas now sends one `canvas_load_timing` per mount, after it settles and the
frames stay under 50 ms for 500 ms:

- `kind`: `navigation` (first canvas of a hard load, times from navigation start) or
  `in_app` (client-side navigation, times from mount);
- `revealed_ms`, `settled_ms`, `interactive_ms`;
- `missing_at_reveal`, `reveal_wait_ms`: how many visible nodes the 1.5 s gate gave up on;
- `renderer`, `device` (memory-budget class: `phone` for every touch device, iPads
  included), `engine`, `nodes`.

Only the main canvas (`spec.chrome`) reports. Logic in `src/lib/canvas/gpu/load-timing.ts`.
