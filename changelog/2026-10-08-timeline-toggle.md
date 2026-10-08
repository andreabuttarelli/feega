# Timeline can be hidden

The side column could hide, the timeline couldn't: preview space on a laptop stayed fixed.

- `Command.ToggleTimeline` (⌘J; ⌘J was free) in the action table, placed in the transport so it
  stays reachable while the timeline is gone — on phone the transport is the bottom bar.
- `EditorLayout.timeline: Panel`, persisted with the rest. Schema defaults it to `Open`, so
  layouts saved before keep their panels and divider height.
- Hiding collapses the grid row (180 ms, off under reduced motion), marks the area `inert`.
  `timelinePx` is untouched, so the divider height returns on reopen.
- Nothing reopens it on its own: selection from layers or agent edits leaves it closed.
