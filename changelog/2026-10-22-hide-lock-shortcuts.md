# ⇧⌘H / ⇧⌘L hide and lock the selection

Figma parity. Two commands (`ToggleHidden`, `ToggleLocked`) in the shortcut
table, run through `BAR_OPS` in `frame-inspector.ts` like every other frame
key: hide/lock all unless all already are, then the reverse. They are frame
keys but not bar buttons (Layers already has the eye and lock). Agent path:
`set_visibility`.
