# Shift+A on canvas tiles, padding shorthand (AL-09, AL-08)

- AL-09: Shift+A did nothing on the canvas (only inside a frame). Tiles have no container, so it
  is a one-shot arrangement, not a live auto layout: `stackTiles` in `canvas/align.ts` puts the
  selected tiles in a row when they are spread across more than down, else a column, `STACK_GAP`
  apart, from the top-left of the selection. New `stack` canvas command and selection action;
  MCP parity is `move_node`, like Tidy up. A live auto layout around tiles needs a container node
  and was not attempted.
- AL-08: the Padding field takes one to four values like CSS (`padding-text.ts`); typing two
  values opens the per-side fields. The on-canvas padding handles already existed
  (`AutoLayoutOverlay`), so only the entry changed.
- Checked in Chromium on test@dazero.co: `~/Documents/feega-videos/e2e/r7-stack-*.png`,
  `r7-padding-shorthand.png`.
