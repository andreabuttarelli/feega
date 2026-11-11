# A stale frame save is a conflict, not a silent overwrite

A tab open before a code Pull replayed its outbox draft after a reload
(`replayDrafts` → `ops` action → `commitOps`). `commitOps` rebased any
stale ops onto the head, and `diffDoc` emits `variables` as one `doc.set`:
the stale map replaced the pulled one (v5 → v6, `brand-rose`/`accent` gone).

Now `commitOps`, the single rebase point for the editor, `save_doc`, the
agent, undo, Pull and MCP, refuses a rebase when an op targets something the
head changed since the base (`clashes` in `doc-ops.ts`), or when the base
revision is gone (coalesced away). The answer is 409 `conflict` with the
head; the editor session adopts it and shows a notice; the outbox drops the
draft instead of retrying forever. Non-overlapping concurrent edits still
rebase. Local file mode runs the same code over its memory store.

Discarded: refusing every stale write (breaks agent + editor co-editing),
and keying `variables` per entry (two edits to one collection still clash).
