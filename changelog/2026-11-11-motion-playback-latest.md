# Motion playback: latest frame wins

The timeline clock already advanced from `performance.now()` deltas. The lag was downstream: every playhead change in `CoreFrames` called `rebuildLive`, which posted one build to the frame worker. The worker answers in order, so when a build took longer than a frame, requests queued and the picture fell further behind the playhead the longer playback ran. `liveGenerations` only dropped stale results after they had been built.

`latestOnly` (`src/lib/canvas/core/latest-only.ts`) keeps one build in flight per frame id and replaces any waiting request with the newest. Superseded frames are never built. Rejected: cancelling worker jobs (no preemption inside a build), a per-tick budget (still queues).
