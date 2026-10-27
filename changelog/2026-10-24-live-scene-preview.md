# A sequence redraws while a scene is being edited

**Before:** the parent frame's scene stamp (`sceneStamp`) used each scene's saved revision, so
the parent redrew only after the scene's background save landed. `CoreFrames.sceneSource`
already preferred the scene's live doc, but nothing told the parent to rebuild.

**Now:** `liveDocs` counts doc edits per node (`edits`, bumped only when the doc changes, not on
playhead moves). `GpuFlow` stamps each scene with `sceneRevision(saved, edits)`, so an edit of
an open scene changes the parent's stamp, and the parent rebuilds from the live doc.

**Tests:** `scene-sources.test.ts` (stamp moves with edits), `live-docs.svelte.test.ts` (edits
count the doc, not the playhead).
