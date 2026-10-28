# Coder mode, and one row for the frame modes

The Design/Motion button and the Dev mode button stacked at the top of the
frame inspector looked heavy. Both now sit on one row: the shell
`SegmentedControl` (Design | Motion) and a compact Coder mode toggle,
in `FrameModeRow.svelte`.

Dev mode is renamed Coder mode in everything the user reads (menu, shortcut
guide, docs, public changelog, the agent tool description). Internal names
(`ToggleDevMode`, `frameProperties.dev`, `DevInspector`) stay.

The frame timeline keeps its own mode button; no selection toolbar on the
frame carried either control, so there was nothing to replace there.
