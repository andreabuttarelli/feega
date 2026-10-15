# Closed frames show their latest revision

**Before.** Dragging a generated image into a frame wrote revision 2, but the closed
frame on the canvas stayed black: the poster captured at revision 1 (`posterAssetId`)
outlived the revision, and when a new capture did start, `MotionNode` shot it from the
preview still loaded for revision 1.

**Now.** `saveMotionDoc` clears `posterAssetId` with every revision, so the canvas
captures a new cover; `previewAt` lets `MotionNode` shoot only from the preview of the
revision the node is at. `posterAssetId` is `.default(null)` in `motionNodeSchema`:
the node patch merge deletes null keys, and the schema check rejected the patch
silently, leaving `docHeadRevision` behind.

**Test.** `canvas-output-pixels.spec.ts`: red image into a frame, red closed and after a
reload. Red before the fixes; with only the client fix still red.
