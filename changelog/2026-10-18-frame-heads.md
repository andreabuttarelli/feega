# A saved frame revision is announced to peers

A peer saw a frame edit only after the writer's 700 ms save debounce, the
commit, the `nodes.data.docHeadRevision` patch, postgres_changes on
`motion-node:` and a head fetch: 1,300 ms in the two-browser e2e.

Now the writer, once `?/ops` answers, broadcasts the landed head
(`frame-head`: node id, version, doc) on the canvas channel through the
frame hub (`frameHub().heads`, `FramePresence.landed/onHead`). The peer's
editor takes it with the existing `takeRemote` → `remote()` rebase, so its
own unsaved work stays on top. The save debounce drops to 250 ms; typing
still coalesces because every edit resets the timer. postgres_changes and
the head poll stay as fallback.

Measured (`frame-heads.spec.ts`, two browser contexts, test account): 800
ms, was 1,300. The rest is the ops commit round-trip.

Not done: streaming unsaved ops for live preview. Peer previews would have
to stay out of the receiver's history, or its next save would commit the
peer's values as its own; that needs a render-only doc layer in
`MotionEditorShell`.
