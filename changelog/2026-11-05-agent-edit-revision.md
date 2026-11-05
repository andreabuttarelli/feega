# Agent frame edits are checked against the revision they read

**Before:** `edit` on a frame took an optional `version`. With it, any newer revision refused the
edit, even when a person had touched an unrelated element. Without it, the edit applied to the
head unchecked. `view` get did not return the frame revision, so an MCP agent had nothing to pass,
and a designer's manual retime could be overwritten by the next prompt.

**Now:**
- `view` get returns `revision` for a frame and for an element of a frame.
- `edit` with `version` = that revision reads the base revision, diffs base → head (what others
  changed) and head → attempted (what the agent changes), at element level (track, clip, doc
  field). Overlap → `409` with `changed: [{ id, now }]`, nothing written. No overlap → the edit
  runs on the head and lands.
- The op → element id mapping is one table, `TOUCHED` in `src/lib/motion/doc-contest.ts`.
- Human edits through optimistic ops are unchanged: last write wins, no extra read.

**Discarded:** keyframe-level granularity (an agent edit on another property of the same clip is
also refused: safer, and rereading is cheap). Making `version` required: it would break CLI
calls that omit it; the MCP description now tells agents to always pass it.

**Not covered:** the in-app sidebar chat does not pass a revision between its own view and edit.
