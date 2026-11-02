# Hide and lock whole nodes

Basics audit #10, #11, #12: hide/lock existed only for clips inside a frame. On a node selection
⇧⌘H / ⇧⌘L did nothing and Layers node rows had no eye or lock.

- **Storage**: `hidden` / `locked` booleans in `nodes.data`, declared in `nodeLayoutSchema` next
  to `rotation` and `groupId` (layout keys valid on every node type). No migration.
- **Model**: `canvas/node-flags.ts` — `flagsOf`, `flagHeld` (a member of a hidden/locked group
  inherits it), `toggledFlags` (on unless every pick already has it, like the in-frame toggle).
- **Wiring**: ⇧⌘H/⇧⌘L → `matchCanvasShortcut` → `KEY_RUN` in `GpuFlow` → `onToggleFlag` →
  `toggleFlag` in the canvas page → `write(id, patch, SaveTiming.Now)` (optimistic, saved via
  `?/write`, undo through the existing `node.update` gesture, realtime through `nodes`). Layers
  node rows call the same function through `CanvasSide.flag`.
- **Effect**: hidden nodes are filtered out of the tiles `GpuFlow` draws and hit-tests; locked
  tiles carry `locked`, which `nodeHeld` refuses for drag, resize and rotate, and nudge skips.
- **Undo bug found on the way**: `ownKeysBack` restored every key whose value matched `after`,
  including keys the gesture never changed. A `null` key (`posterAssetId: null` on frames) went
  back as a `null` patch, which deletes it, and the next schema-checked write failed with
  `motion.data.posterAssetId: expected string`. Now only keys that changed are restored.

Not done: hide/lock in the node context menu.
