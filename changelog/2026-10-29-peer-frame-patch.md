# A teammate's frame edit lands in place

When user A finished an edit in a frame, user B's canvas blanked the whole frame for about
half a second (paper colour: white in light theme, dark in dark theme), then showed the new
revision.

Cause: a new revision gets a new display-list key (`id:revision`). Until it was fetched and
built, `framePuts` in `CoreFrames.svelte` had no list for the frame, so `postersFor` put the
frame's poster card (the node card face) in front of the last raster. Each revision also cost
two `/source` fetches on B (pick doc + core frame).

- `shownGroup` (`frame-source.ts`): a frame keeps drawing the last revision it built until the
  new one is built, then swaps. The last drawn layer is also kept while the new one's pictures
  upload, so a phone (no retain window) never drops to the stand-in.
- `PeerStep` (`frame-step.ts`): a landed save announces `{ nodeId, base, version, ops }` on the
  existing `frame-head` broadcast, unused since the editor route left. Ops are
  `diffDoc(previous server head, landed server head)`, sent only when the version moved by
  exactly one. B applies them with `applyOps` onto the doc it holds at `base`; the core frame
  builds from that doc without a fetch and the pick doc follows. Only the changed items are
  re-encoded on the GPU (`patchGroup` splice, already there).
- B with a session on the frame (selected or edited) follows the step through
  `FrameEditSession.followStep`: local edits are rebased, the selection kept. A session behind
  the canvas revision with no step fetches the head after 400 ms (`followHead`); before, such a
  session never followed teammates at all.
- `follow()` updates the history before telling the host it saved, so the host shows the
  followed doc instead of the one before it.

Fallback to the fetch: a version gap, a file B has no URL for, linked instances (their source
doc is resolved server side), a missed broadcast. The fetch waits up to 300 ms for a step.

Measured with `tests/e2e/peer-frame-patch.spec.ts` (two contexts on the test account, real
stack, headed Chrome, 50 ms screenshots of B's frame, A nudges an element three times).
Before: 6 of ~40 samples matched neither the before nor the after state (~500 ms blank), two
fetches per revision, change visible on B 1.75 s after the keypress. After: 0 stray samples in
10 runs (B watching and B holding the frame selected), no fetch in 8 of 10, change visible
1.06-1.46 s after the keypress, 250 ms save debounce included.

Discarded: broadcasting the whole doc (the old `frame-head` payload): 1.4 MB docs exist and
realtime payloads are capped.
