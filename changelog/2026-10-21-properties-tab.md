# Frame inspector moves into the right bar (Properties tab)

The inspector from #1082 floated over the canvas. It now renders into the right bar's Properties pane.

- Tabs: Properties, Chat, Guides (order set in `RightBarHost.tabs`). Guide label became "Guides".
- `FrameProperties` (`frame-properties.svelte.ts`) carries the frame session from `GpuFlow` to `CanvasChatPanel`, which claims the bar with a `properties` binding and portals `FrameInspectorPanel` into `rightBar.propertiesPane`. The panel shows an empty state with no selection.
- Selecting an element switches to Properties unless the chat field in the bar has text (`typingInBar`).
- Last tab remembered in localStorage (`properties` joins `CHAT_TABS`). Phone sheet uses the same bar, so it gets the same tabs.
- Floating panel removed from `GpuFlow`.

Discarded: a second inspector host inside the canvas; the bar already had the Properties seat for the motion editor.

Proof: `tests/e2e/canvas-frames-props-tab.spec.ts` (select, edit, Chat and back, frame box unchanged).
