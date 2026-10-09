# Agent turns run up to 30 minutes

Background agent turns died at Vercel's 300 s cut ("Task timed out after 300 seconds").

- `AGENT_MAX_DURATION_S` = 1800 (Fluid compute, paid plan). Everything time-based derives from it
  in `brand-agent/limits.ts`: stop deadline (max − 30 s), self-save (max − 25 s, `TurnTiming`),
  stale window (max + 60 s) used by `turnRunning` and by `expireStuckRuns` for `motion-ask` runs
  (new `agent_turn` job kind; before, they fell under the 6-minute sync window).
- Steps 80 → 240: per-step budgets (frame waits, delegation wait 90 s) unchanged, more rounds allowed.
- Hard cost cap per turn: `AGENT_TURN_CAP_USD` = 1.5 (model tokens), shared by the motion turn
  (was `MOTION_TURN_CAP_USD`) and now enforced on the canvas chat too, which had none.
- Only the three agent routes take 1800; the adapter default stays 300 so cron claim windows
  (video render 15 min, studio drain 10 min) stay valid. The agent routes are a second function
  group; `scripts/single-function.test.ts` allows exactly default + agent limit.
- MCP/CLI `wait` still polls ~4 min; the text now says a turn can run 30.
