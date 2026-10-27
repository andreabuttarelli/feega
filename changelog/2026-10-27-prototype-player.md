# Prototype player

Figma-parity gap T2 (rows 22, 23, 24 of the audit). Depends on PR #1394 (`prototype-links`), which
defines `clip.interactions`; this branch is cut from it and targets `dev`, so merge #1394 first.

- Player: `PrototypePlayer.svelte` shows one frame at a time and runs the links. The rules sit in
  `src/lib/motion/prototype/player.ts` (a pure state machine: current frame, history, overlay
  stack; `act(state, action, transition, knownFrames) -> {state, move}`), the transitions in
  `transition-plan.ts` (keyframes for the Web Animations API, reversed for Back), the hit areas in
  `hotspots.ts` (layer rects from the same `framePicker` the canvas uses, as fractions of the
  frame). Navigate and Scroll to are the same move; Scroll to does not scroll inside a frame.
- Flows: `doc.flow = { name }` (motion-core `prototype/flow.ts`). A flow is the frame marked as a
  starting point, so no table or column was added (migrations do not deploy with the app).
  `set_flow` is the agent tool; parity table updated.
- In the app: `FlowSection` in the frame inspector (Play, starting point, Copy play link);
  `PrototypePlayerHost` in `GpuFlow` feeds the player the live docs of the canvas frames.
- Public: `/play/[token]?frame=` reads the canvas share token like `/s/[token]` and serves only
  frames that are published as embeds, with their docs and signed assets
  (`prototype-share.ts`). `sharePlay` (`agent-play.ts`) publishes everything reachable from the
  frame (`reach.ts`), turns the share on and returns `url`, `frames`, `flows`.
- Surface: editor route `.../motion/[nodeId]/play`, `POST /api/v1/motion/[nodeId]/play`, project
  agent and MCP `get_play_link`, `feega motion play`.

Discarded: a `flows` table (needs a migration, and a flow is one frame's mark); rendering the
public player from the hosted embed iframes (the interactions are not in the embed bundle);
undoing a hover when the pointer leaves (the layer disappears with the frame, so there is no leave
event; a Back link does it).
