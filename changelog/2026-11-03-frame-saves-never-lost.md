# Frames hold 1000 layers, tall frames, paste into the selected frame

From the landing case study (2026-11-02, canvas f2824d6c).

- **B1, saves failed silently after ~20 layers.** Every design layer sits on its own visual track
  (z-order is track order), wraps add a container track, and deleted layers left their track
  empty. `MAX_TRACKS` was 20, so the 21st track turned every save into a 400 `tracks: Too big`
  while the canvas kept showing the edit; a reload lost it. `MAX_TRACKS` is now 1000 (root and
  comps), and `removeLayers` drops the tracks the delete emptied (a track that was already empty
  is kept: the timeline can hold an empty one on purpose). Discarded: one shared track for design
  layers — it would rewrite z-order everywhere.
- **Save failures and PNG text: dev's version kept.** This branch also added a retry/IndexedDB
  draft path (`frame-save.ts`) and a `shownFrame` export seek. Merging dev brought #1785's
  durable frame drafts (`frame-sync`, `postFrameOps`) and the video poster frame
  (`posterSecond`), which cover both; the duplicates were dropped in the merge.
- **Major #1, frame height over 3840 reverted.** The canvas frame tool makes a video frame, and the
  doc schema held video frames to 4K. A frame now takes up to 16384 px a side whatever its mode;
  the video limits stay where they belong, in `exportProblem` at export. A size over 16384 is
  scaled to fit and the canvas says so.
- **#16, paste into another frame landed loose.** With elements copied out of a frame and one
  other frame selected, ⌘V placed them at the pointer (`pasteElementsAt`), so a pointer outside
  that frame dropped them on the canvas; only two or more selected frames took the paste.
  `elementPaste` decides once: the pointer's frame when it is the selected one, otherwise every
  selected frame. The 404 on the loose copies came from source clips whose save had been refused
  (B1): the server copy found nothing to copy.
