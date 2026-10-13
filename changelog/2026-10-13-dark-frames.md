# Dark frames block delivery; stalled picture downloads no longer hang export

**Why.** In the versus benchmark (run 1) app-showcase shipped 91% near-black frames and the
agent called it done: `frameProblems` only flagged *flat* frames (`lumaStd < 4`), and a dark
frame with a small, faint UI has enough spread to pass. saas-launch's browser export failed
with "the frame at 6.67s did not draw within 60s".

**What.**
- `FrameStat.litShare` (share of pixels with luma >= 48), measured in `frame-stats.ts`.
- `Quality.DarkFrames`, blocking: when at least half of the sampled frames are under 3% lit.
  It feeds the same gate as `view_frames`, so the self-check rounds must fix it.
- `shrinkImage` (runs inside the capture iframe for every remote picture) now aborts its
  `fetch` after 8 s. Before, a download that never finished held that frame's capture until
  the driver's shared 60 s timeout killed the whole export.

**Not proven.** The saas-launch doc could not be rebuilt (chat_messages keeps tool outputs
truncated at ~2 KB), so the 6.67 s hang is not reproduced; the unbounded fetch is the one
await on the capture path with no timeout, fixed with a test. The preview being black from
t=0 points to something wider that this change does not address.
