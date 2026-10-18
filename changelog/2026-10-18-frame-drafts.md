# Unsaved frame edits stream to peers

A peer saw a frame edit only once it was saved and announced (800 ms).
Now every edit also sends the editor's unsaved ops (`outgoing(base,
present)`) at most every 100 ms as a `frame-draft` broadcast (node,
tab, base version, ops; ops validated with `parseOps`).

The receiving editor keeps peers' drafts outside its undo history: the
canvas it draws is `withDrafts(base, present, drafts)` — the peers' ops
applied on the shared base, with my own unsaved work rebased on top, so on
the same field mine shows. A draft based on another version is ignored,
and a landed save sends an empty draft that clears it.

Editing what I see must not commit what a peer has not saved: when drafts
are shown, `edit()` keeps only my change (`ownEdit`: the diff between the
shown doc and my result, applied to my own present). Without drafts the
edit path is unchanged.

Two-browser e2e (`frame-heads.spec.ts`): an opacity change shows in the
other browser in ~195 ms (was ~800 ms through the save).
