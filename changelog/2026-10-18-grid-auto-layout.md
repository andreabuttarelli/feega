# Grid auto layout

`Direction.Grid` in the pure layout engine with CSS-grid semantics:
`columns` equal-width tracks (`repeat(n, 1fr)`), auto rows as tall as their tallest
child, `gap` between columns, `crossGap` between rows, justify/align place a child
in its cell, Fill stretches to the cell. Hug: widest child per column, summed rows.
Kept in the engine (ADR 0008: boxes resolved before render), no external layout lib.
UI: Grid segment + Columns field; agent parity via `set_auto_layout`.
