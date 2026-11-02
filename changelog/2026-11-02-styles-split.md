# Styles panel: text and colour scroll apart

With 25+ text styles, colour styles sat below the fold of one long list. The left-panel
Styles view now splits into two regions (Text; Colour + Effect), each with a sticky header and
its own scroll, separated by a draggable, keyboard-accessible divider. The ratio (default 50/50,
clamped 15–85%) persists in `feega.stylesSplit` via `shell-prefs`, like the other panel sizes.
An empty region shrinks to header + empty line. The frame inspector keeps the stacked layout
(`StyleLayout.Stack`), since there it lives inside a scrolling column.
