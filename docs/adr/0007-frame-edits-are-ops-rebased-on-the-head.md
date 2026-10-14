# A frame edit is a list of ops, rebased by the server onto the latest head

Context: a frame (motion node) is one `MotionDoc` per row of `motion_revisions`, written with an
optimistic `version`. Two people in the same frame, or a person and the motion agent / an MCP
agent, wrote whole docs: the second writer got a 409 and lost its edit, or — the agent turn —
retried at the new head with its own whole doc and silently erased what the person typed during
the turn.

Decision: an edit travels as a list of small typed ops (`src/lib/motion/doc-ops.ts`), addressed
by id, never by position:

- `doc.set` / `doc.entry` — a top-level field, or one key of `comps`, `components`, `links`;
- `track.add` / `track.remove` / `track.move` / `track.set`;
- `clip.add` / `clip.remove` / `clip.move` / `clip.set`, and `clip.entry` for one key of a clip's
  `props`, `keyframes` or `transform`.

Ops are not written by hand at each call site: `diffDoc(before, after)` derives them from the two
docs an edit produced. Every existing doc function (the ~90 motion tools, the editor's clip ops,
move-element) is therefore already an op producer, with no rewrite.

The server rebases by re-applying: `commitOps` reads the head, applies the ops to it, validates
the result with `parseMotionDoc`, and appends `head + 1`; a unique-key race re-reads and retries.
Applying is tolerant by construction: an op on a clip or track that no longer exists is dropped
(delete wins over edit), an index is clamped, an add of an id that exists is skipped. So ops on
different clips, or different props/keyframes of one clip, commute; two writes to the same field
resolve last-writer-wins. A merge that breaks a doc-wide rule (duration, resolution) is refused as
invalid, never written.

`commitDoc(base, doc)` is the same path for a writer that holds whole docs: the agent turn, MCP
`runMotionTool`. Their edits land on top of the person's, not over them.

Broadcast is the revision itself, not a realtime message. Each write already patches
`nodes.data.docHeadRevision`, which Realtime publishes; an open editor reads the head and rebases
its pending local ops on it (`rebase(base, mine, theirs)`). A missed broadcast message would be a
lost edit; a missed row change is caught up by the next one, because the head is durable.

Consequences:

- No op-log table and no migration: the history is the revisions, and the ops between two of
  them are `diffDoc` of their docs. Revisions stay coalesced by the editor's save debounce.
- Not a CRDT: concurrent text edits of one string are not merged character by character — the
  last write wins on the field. Accepted: a frame's strings are short labels, and a CRDT library
  plus its storage format is the cost this avoids.
- Clip order inside a track is last-writer-wins when both sides reorder it.
- The old whole-doc `save` action stays as a fallback while the client moves to `ops`.
- Undo becomes per user: undoing applies the inverse of my own ops to the current doc, so it
  never reverts someone else's edit.
