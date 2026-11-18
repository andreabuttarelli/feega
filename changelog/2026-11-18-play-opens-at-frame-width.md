# Play opens at the frame's own width

Play opened in Responsive / Follow window: `docAtWidth(doc, stageWidth)` re-resolved the frame
at the stage width (1568 px for a 1280 frame in a 1600 px window). Stacks re-flowed, centred art
grew, text wrapped elsewhere: on the engine path Play differed from the canvas by 7.8% of pixels
(Vercel landing) even though both draw with gpu-core and the same shaped text.

Now the default width source is `WidthSource.Frame`: `docShown` hands Play the doc the canvas
draws, untouched, and `frameBox` only scales it down when the stage is narrower. Follow window,
the device buttons, the width field and the frame's views still re-lay the frame out, as an
explicit choice. A stored choice is kept.

Rejected: opening in Fill width (scales a 1280 frame up to the window and blurs it) and calling
`docAtWidth` at the frame width (`resolveView` of the base view re-runs layout with the
estimated text measure, not the shaped one).

Measured on the landings fixture before the change, canvas at 100% vs Play as opened, top
1280x860, pixels off by more than 48: Vercel 7.77%, Notion 95.99% (the centred page moved
sideways). At the frame width the same frames were 0.27% and 1.66%.

Not in this change: frames taller than 8192 px still play on the HTML player
(`drawableOn`); with #2318's strips the cap applies to width only on the cores, in a PR
stacked on #2318. The HTML
player's sandboxed iframe cannot load fonts from `/local/storage` (no CORS header, opaque
origin), so in local mode its uploaded fonts fall back.
