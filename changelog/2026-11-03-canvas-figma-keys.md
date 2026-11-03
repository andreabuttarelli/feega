# Canvas keys from Figma: quick actions, A, distribute

From the text/shortcut audit (#18, part).

- **⌘/** opened cursor chat: `CursorChat` matched `/` with any modifier. Quick actions (the command
  palette) now open on ⌘/ as well as ⌘K (`togglesPalette`); cursor chat takes `/` alone
  (`opensCursorChat`). Both rules live in `command-palette.ts`.
- **A** arms the frame tool in Design, next to F.
- **⌃⌥H / ⌃⌥V** distribute the selected tiles (`distributeTiles`, the same as the right bar).

Not in this change: H hand, I eyedropper, K scale on the canvas, ⌃G layout grid, ⇧⌘K place image,
⌘\ hide UI, ⇧⌘V paste over on the canvas, Motion-mode transport keys.
