# Motion quality eval

`npm run eval:motion` runs five fixed briefs through the real motion chat agent (default model)
on throwaway accounts, via Playwright on a local dev server, and exports each video in the
browser. Before it, every quality judgement came from one-off drivers in `~/Documents/feega-videos`
that measured different things each time, so "did it get worse?" had no answer.

- Facts before taste: duration, scene holds (cuts from the doc's top-level clip starts; ffmpeg
  scene detection missed slow cross-fades and found 1 scene in a 34 s video), share of 1 fps
  frames with low edge density, smallest text size, recreated vs kit UI clips, cuts within 0.1 s
  of a music beat (repo `analyzeAudio` on the exported audio), blocking left in the last
  `view_frames`, tool errors, page errors, cost from `ai_calls` read before teardown, wall time.
- Taste: one Sonnet call per video, 8 stills, anchored on Saturn/Nimbra stills (9/10) and the
  2026-10-10 feega trailer (3/10), in `scripts/eval/motion-quality/anchors/`.
- `unrun` with the reason for any case that failed or hit the budget cap; teardown in `finally`.
- Discarded: farm renders (cost, and not what users export), a judge per frame (cost).

Baseline (main 57e719e4, $9.12): feega export timed out (51 s video, 20 min cap, now 45);
linear / stripe / shop / app: 27–43 s, mean hold 3.0–4.3 s, 25–61% empty frames, 0 recreated
UI, judge density 2–3 and premium 4–5 on every case.
