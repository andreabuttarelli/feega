# Frame saves are never lost, PNG export keeps text, tall frames

From the landing case study (2026-11-02, canvas f2824d6c).

- **B1, saves failed silently after ~20 layers.** Every design layer sits on its own visual track
  (z-order is track order), wraps add a container track, and deleted layers left their track
  empty. `MAX_TRACKS` was 20, so the 21st track turned every save into a 400 `tracks: Too big`
  while the canvas kept showing the edit; a reload lost it. `MAX_TRACKS` is now 1000 (root and
  comps), and `removeLayers` drops the tracks the delete emptied (a track that was already empty
  is kept: the timeline can hold an empty one on purpose). Discarded: one shared track for design
  layers — it would rewrite z-order everywhere.
- **Saves that fail are never silent.** `FrameEditSession` tells a refused save (`SaveFailure.Refused`:
  4xx, signed out) from one that did not arrive (`Transient`: network, 5xx, 409 busy). Transient
  saves retry with backoff (1 s doubling to 30 s); refused ones show the server reason in the
  canvas alert and stay unsaved (`unsaved()` now covers `Failed`, so leaving warns). Before, the
  send turned any non-success into `Save failed` and a thrown fetch left the session saving
  forever.
- **The edit is kept on the device.** Before each send the session hands its ops and base
  revision to the host (`keep`), and drops them when the save lands (`release`). The canvas keeps
  them in IndexedDB (`feega-frame-drafts`, `frame-save.ts`); on load a frame whose draft was made
  on the revision it opens with replays it and saves again. A draft from another revision is
  dropped: replaying ops over someone else's head is not safe.
- **B4, PNG export dropped all text.** The raster export seeked a video frame to 0 s, where text
  is still fading in (`Text` enters with opacity 0). It now shoots the frame the canvas shows
  (`shownFrame`: the still frame, or the rest frame), and so does the SVG still.
- **Major #1, frame height over 3840 reverted.** The canvas frame tool makes a video frame, and the
  doc schema held video frames to 4K. A frame now takes up to 16384 px a side whatever its mode;
  the video limits stay where they belong, in `exportProblem` at export. A size over 16384 is
  scaled to fit and the canvas says so.
