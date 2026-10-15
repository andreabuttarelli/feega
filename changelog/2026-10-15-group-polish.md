# Group limits from #634

- Rotation undo: client-side `turn` entry on the canvas undo stack; undo is the same turn the other way (`undoTurn`), redo turns back. The server action answers `turn`.
- Scale: `scaleGroup` (members scaled about the group corner, sizes included), action `scaleGroup`, MCP `scale_group`. Resizing a group tile goes through it.
- Live follow: `followGroup` moves members by the group's drag delta on every drag frame (CanvasFlow `onNodeDrag`).
- Member clicks: a group renders with `zIndex: -2000` (`frameChrome.behind`), so its members stay above it even while it is selected; a click on a member selects the member.
- Previews: elements and groups with no poster yet mount their player (`frameChrome.liveWhileMissing`) instead of a dashed outline, until the poster lands.

Chat budget: `move_group` / `scale_group` are reachable through `canvas_tool`, not as own chat tools (prompt stays under 30k chars).
