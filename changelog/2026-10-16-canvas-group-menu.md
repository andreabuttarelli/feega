# Group in the toolbar, canvas context menu

Groups existed only behind ⌘G / ⇧⌘G: a user found no way to make one.

- `SELECTION_ACTIONS` gains `group`, `ungroup`, `copy`, `paste`, `bring-front`, `send-back`.
  Group/Ungroup show in the selection toolbar; `shownFor` hides Ungroup unless a group is picked.
- `CANVAS_MENU` (same table) drives `CanvasContextMenu.svelte`, opened by `onnodecontextmenu`,
  `onselectioncontextmenu`, or a 500 ms touch long-press. Shortcuts render with `Kbd`.
- Z-order: `restacked` (pure) + `restack` page action → `moveNode` with `z`; MCP parity is
  `move_node`'s existing `z`. ⌘] / ⌘[ in `shortcuts.ts`.
- ⌘G already handled mixed selections (free elements become clips, other nodes join by `groupId`);
  unchanged.

Path: right-click in `CanvasFlow.svelte` → `CanvasContextMenu` → `SELECTION_RUN` → `onGroup` /
`onRestack` in `c/[canvasId]/+page.svelte` → `groupElements` / `restack` actions → `nodes`.
Covered by `tests/e2e/canvas-groups.spec.ts` (toolbar Group, right-click Ungroup, Send to back).
