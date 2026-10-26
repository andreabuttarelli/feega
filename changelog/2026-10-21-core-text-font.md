# Core card text uses the interface font

Cards drawn by the core still used DM Sans after #1071 moved the interface to
BDO Grotesk, so a card changed width and letterforms when selected (DOM) and
deselected (core). `core-font.ts` now declares the core faces (400, 600); a test
checks them against the `--sans` family and `@font-face` rules in `app.css`.

Not found: the cause of the blurry bitmap on click-to-edit; needs a browser.

## Frame selection mounts its DOM tile again

#1069 left selected frames out of the DOM set under the core. The inline editor
stages on the `MotionNode` host (`inlineStage.offer`), so with no tile the player
mounted at 0x0 and the frame was re-fitted, rescaling its content. `editableIds`
is back to the plain capped selection. Cost: the select/deselect swap flash #1069
tried to remove returns; it needs a fix that keeps the host mounted while the core
keeps drawing. `frameBar.host` is `$state.raw` (proxy broke the teardown identity check).

## Frame hover overlay stops above the bar

FrameHover filled the whole tile, bar included, while its contain-fit assumes the stage only. Highlights sat offset from the core drawing. The tile now carries `--bar-h` and the overlay insets by it.
