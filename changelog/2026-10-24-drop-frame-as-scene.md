# Drag a frame onto a sequence to insert it as a scene

**Before:** a frame joined a sequence only through Insert frame (always at the end) or Combine.

**Now:** dragging a plain frame onto a sequence frame inserts it as a scene at the scene
boundary nearest the drop (`insertSceneAt`). The drop's horizontal position in the frame maps
to time (`scene-drop.ts`). Click in `GpuFlow.endDrag` -> `onInsertScene` -> `insertScene`
action in `canvas-page.ts` -> `insertScene` in `server/motion/insert-scene.ts` -> revision
write on the parent frame. Agents: `edit_scenes` insert takes an optional `at` in seconds
(`insertScene` is its UI action in `ui-actions.ts`).

**Refused:** dropping onto a frame that is not a sequence (normal move), dropping a sequence
(cycles), a multi-selection, docs not yet loaded.

**Decisions:** nearest boundary, not a split inside a scene: scenes stay whole references.
