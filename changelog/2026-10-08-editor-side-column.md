# Motion editor: one side column, Chat | Properties

Before: on desktop two fixed columns, properties 300px and chat 360px, toggled separately.

Now: one `SideColumn` (`src/lib/components/motion/SideColumn.svelte`) with a tablist on top.
Both panes stay mounted; the hidden one gets `hidden` (CSS), never `{#if}`, so a running agent
turn keeps streaming and draft/scroll survive. `ChatPanel` gained `onbusy` to drive the activity
dot on the Chat tab.

Width: default 400px, drag the left edge (pointer capture, 44px hit area, touch), clamp
`sideWidth` to [320px, 50% window], double-click resets. `side` and `sidePx` live in the existing
`motion-editor-layout` localStorage record; old records fail the schema and fall back to default.

⌘B / ⌥⌘B: `toggleSide` shows that segment, or closes the column if it is already showing.

Decided: no auto-switch on selection or agent edits. Tablet (drawer) and phone (sheets) unchanged:
the column is `display: contents` there and draws no tabs.
