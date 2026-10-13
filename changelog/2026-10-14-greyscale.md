# Greyscale chrome and a grey canvas

**Before.** The `--ui-*` greys carried a warm tint (`#fafaf8`, `#f2f2ef`, `#5c5c58`…), the
tertiary text grey `#93938e` read at 3:1 on white (below AA), and the canvas was white paper,
the same as the nodes on it.

**Now.** Every chrome token is a true grey, in light and dark, and text greys meet WCAG AA on
every ground they sit on (`src/lib/greyscale-tokens.test.ts` parses `src/app.css` and checks
it). The canvas has its own tokens, `--canvas-bg` / `--canvas-dot` (`#e6e6e6` / `#c8c8c8`, dark
`#1c1c1c` / `#333`), so white nodes and the bars stand apart by surface, not lines. The accent
stays for selection and primary actions. DESIGN.md says so in its rules table.

**Also.** `canvas-full-bleed.spec` still expected the canvas at the window's left edge; since the
docked left bar (#485) it starts right after the bar.

**Not done.** The legacy violet `--accent` (chat bubbles, canvas edge selection) is unchanged:
it is a different system from `--ui-accent` and recolouring it is its own change.
