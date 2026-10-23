# Opacity digit keys

Figma sets opacity from the number row: 1 = 10% ... 9 = 90%, 0 = 100%. Ten `Command.Opacity*`
entries come from one table (`OPACITY_KEYS` in `motion/shortcuts.ts`) that also builds the
bindings, the `ACTIONS` rows, the parity rows (`set_transform`, which already carries
`opacity`) and the frame bar ops, so the next step is one row. Design mode only: in Motion the
digits stay free. Writes the clip transform opacity of every picked element in the frame.
