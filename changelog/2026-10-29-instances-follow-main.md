# Instances follow their main across frames and canvases

Before: `placeInstance` copied the main's comp into the target frame doc; edits to the main
reached same-frame instances only. Now an instance resolves its main at read time (ADR 0025).

- `linkedMains` (`src/lib/motion/linked-mains.ts`): every comp whose `component.home` names
  another frame is replaced by that frame's current main, nested comps included. Overrides live
  on the instance clip, so they survive. Home frame deleted, or no longer holding the main:
  instances detach with overrides baked in. No `home`: stays a local copy. A main that would
  contain itself keeps the stored copy.
- `linkedHead` (server) applies it in `headOrNew`, `motionSource` and the editor session, so
  ops, render, codegen export, MCP/CLI reads and the canvas all see the resolved instance.
  Writes refresh the stored copy as a side effect.
- Realtime: `saveMotionDoc` writes `data.mainHomes`; a save whose mains changed (signature)
  patches `data.linked[home]` on dependent frames (`nodes` is realtime), and `FrameAt.linked`
  joins the fetch key so open canvases refetch.

Discarded: fanning out new `motion_revisions` to dependent frames (write amplification, version
conflicts with open editors). Known gaps: a frame open in an edit session keeps its in-memory
copy until reopened; frames written by `move-element` or branching get `mainHomes` on their
next save. No migration.
