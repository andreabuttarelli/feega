# Remote cursors and drags move smoothly

Peers were drawn at the position of the last message: a step every tick
(50 ms), frozen frames between steps (21–35 % of frames in the e2e), and
jumps when messages arrived bunched.

Now (`playout.ts`, `peer-tracks.ts`):
- every cursor and live drag/resize/rotate box keeps its recent samples
  on the **sender's clock** (`at` of the mark; the receiver's clock offset
  is the minimum observed delay), so network jitter does not bunch them;
- each animation frame draws the position a small playout delay behind
  (3 median gaps, 80–250 ms), linearly between the two samples around it;
- past the last sample it extrapolates for `EXTRAPOLATE_MS` and then
  eases back to where the sender stopped; a jump over `SNAP_PX` snaps;
- the frame loop runs only while something moved in the last second, and
  not in a hidden tab (there the raw positions are used).
- The tick is 33 ms (30 Hz) up to four peers, still slowed by `hzFor` past
  that to stay in the Pro quota.

Measured (`peer-smoothness.spec.ts`, two browser contexts, a cursor
circling at 60 Hz, receiver sampled every frame):

| | deviation from a smooth path | frozen frames | receiver frame p95 |
|---|---|---|---|
| before | 2.2–2.7 px | 21–35 % | 17.6 ms |
| after | 1.0–1.3 px | 2–5 % | 17.5 ms |

Cost: ~100 ms added latency (cursor ~170 → ~200–250 ms). A Catmull-Rom
spline was tried and measured worse (2.3 px) with uneven sample spacing.
Side-by-side recording: `~/Documents/feega-videos/figma-multiplayer/smoothness/side-by-side.mp4`.
