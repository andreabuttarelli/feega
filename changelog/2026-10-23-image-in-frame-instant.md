# Insert image in a frame is instant

After #1147 the image only appeared once upload, server write and snapshot had all returned
(~3s): the frame stayed empty and the timeline said "Press + Add" in the meantime.

- `insertImageInFrame` (GpuFlow) no longer goes through `onPasteData` -> `upload` -> `post('upload')`.
  It places the clip in the frame's edit session at once with a blob URL (`imageInFrame`,
  `image-in-frame.ts`), uploads through `FrameExtras.uploadMedia`, then swaps the temporary asset
  id for the real one (`withAssetSwapped`) and lets the session save through the normal ops path.
- `FrameEditSession.holdSave` keeps the debounced save from sending the temporary id;
  `settleHeld` rewrites the document without scheduling a second save.
- Failed upload: the placement is undone and `onfail` shows the reason.
- The add-bar button that opens the frame's own library is "Templates for this frame"
  (`frame-library`), so it is not confused with "Frame templates", which inserts new frames.
- An empty frame is #0a0a0a (`brand.background`), not a render failure.
