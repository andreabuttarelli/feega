# Canvas shortcuts tell the truth, Design is the default bar

Found while recording a demo in local mode.

- **⌥⌘[ / ⌥⌘] did nothing.** On the canvas, `altCommand` returned only
  ⌃⌥T for ⌥+mod, so the bracket pair fell through. Inside a frame,
  `frameKeyAction` had no arrange commands, and the right-click
  "Bring to front / Send to back" mapped to `{ arrange }`, a variant no
  caller ran. Arrange is now four `BAR_OPS` entries over
  `arrangeLayers`, reached by keys and menu alike; tiles take ⌥⌘[ / ⌥⌘]
  too.
- **Tool tooltips listed keys the canvas ignores.** "T ⇧T" joined every
  registry label, including the motion editor's Design-mode bare letters.
  `canvasToolKeys` keeps only the labels `matchCanvasShortcut` answers.
- **Frame tool shortcut: ⇧F, not F.** Decision: on the canvas every draw
  tool is ⇧+letter, because bare letters belong to the timeline (R, T,
  P, S reveal properties, L plays). F joins that row as `Command.ToolFrame`
  so the registry, the tooltip and the help agree. Bare F stays free.
  The old test name claimed a "global registry" owned bare letters; none
  exists any more, the test now says the timeline owns them.
- **The bottom bar opened on Generate.** `readBarMode` now falls back to
  Design; a remembered choice still wins.
