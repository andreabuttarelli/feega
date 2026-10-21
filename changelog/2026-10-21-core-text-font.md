# Core card text uses the interface font

Cards drawn by the core still used DM Sans after #1071 moved the interface to
BDO Grotesk, so a card changed width and letterforms when selected (DOM) and
deselected (core). `core-font.ts` now declares the core faces (400, 600); a test
checks them against the `--sans` family and `@font-face` rules in `app.css`.

Not found: the cause of the blurry bitmap on click-to-edit; needs a browser.
