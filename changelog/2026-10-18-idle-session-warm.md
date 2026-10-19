# Warm frame sessions at idle

Opening a frame waited on its session request (prod p50 725 ms). Two gaps:

- The old warm-up fetched the first 6 motion nodes of the canvas (not those in view) 500 ms after
  load, and `earlyFetch` drops a result after 15 s, so it rarely helped.
- A warmed session was only reusable within those 15 s: `reopened` needed a head the editor had
  left, which a never-opened frame does not have.

Now, every second at idle, `framesToWarm` (`src/lib/canvas/warm-frames.ts`) picks up to 6 frames in
view nearest the centre, skipping those already warmed at the same node version. Landed sessions
go to `lastSessions`; `reopened` accepts a cached session's own head while the node's head
revision has not moved past it, so a peer's save still forces a fetch.

Local, Chrome, heavy canvas: warm open 342 → 81 ms visible; cold open 948 → 654 ms, no session
request left on the open — the rest is the first render.
