# A save reply is handled after the frame that draws the edit

The previous edit's save reply landed between an edit and its first paint: `landed` → `follow`
(rebase, about 70 ms on landings) → `keepDraft` → the follow-up save, all before the next
animation frame. `FrameEditSession.save` now waits for `afterPaint` once the reply arrives.

- Safety: while it waits `saving` stays true, so every interleaving (edits → `resave`, remote steps
  → `missedRemote`, `settled()`) is one a slower network already produced. Version and conflict
  handling are unchanged.
- No frame ever drawn (hidden tab, unmounted canvas): a 1 s bound handles the reply anyway.
- `flushPending` (beforeunload, back online) stops the wait, so the follow-up save is sent now.
- Discarded: waiting only when a patched frame is pending. The pacer does not expose it, and
  always waiting costs at most one frame of reply latency, which nobody sees.
