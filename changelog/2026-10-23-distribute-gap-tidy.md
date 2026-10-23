# Distribute with an exact gap, tidy up elements

`distributeSpace` takes an optional `spacing` (px): the first element stays and each next one sits
exactly that far from the one before, from two elements up (the even spread still needs three).
`AlignBar` gets a gap field next to the distribute buttons; MCP `arrange_space` gets `spacing`
for `distribute_x` and `distribute_y` (tool pin snapshot updated on purpose for that one op).

Tidy up (Ctrl+Alt+T) now works on elements picked inside a frame: `Command.TidyUp` is a frame bar
op over `tidySpace`, which MCP already had as `arrange_space tidy`.
Browser check: `tests/e2e/canvas-distribute-spacing.spec.ts`.
