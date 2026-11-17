# Server renders size text with the font, like the canvas

The GPU canvas laid text out with the shaper it draws with (`shapedText`, fontkit over the real
font files). Every `composeHtml` render — server stills, farm videos, agent frames, selection
export — used `textExtent`, an average-advance table that knows neither the family nor the weight.
So a hugged text box on a server render was a different width from the one on the canvas, and the
text's fit shrank or the box shifted.

Measured against Chromium (`npm run test:text-metrics`, 756 cases): estimate p50 9.9%, p90 45%,
max 52% (CJK at half an em, monospace, emoji, bold); shaper ≤ 0.7% except emoji.

- `withShapedText` (`src/lib/server/motion/shaped-compose.ts`) loads the doc's fonts and passes
  `shapedText` as the compose measure, only when the doc has an auto-layout container. The
  stylesheet is fetched with a browser user agent: without one Google Fonts serves a static
  default-weight file for variable families.
- The Title's line wrappers carry a descender pad that collapsed through the Title element, so
  the HTML fit saw every Title 0.08em too tall and shrank it one 0.95 step. `display: flow-root`
  keeps it inside. This, not the width estimate, was the gate's 598 vs 629 px headline.

Existing docs: free-placed text is untouched (its box is stored). Text in a Stack reflows on server
renders toward what the canvas already showed: on the real-sites fixture 6–121 text boxes per page
move or resize by more than 1 px, up to 93 px on one Figma heading.

Not changed: compose in the browser players and published interactive pages, the code export's
own layout pass, and the editor's layout ops still use the estimate; instances with overrides are
laid out by the estimate inside `flattenComps`. Discarded: a better per-font advance table — still
an estimate, and the shaper is already loaded wherever fonts are.
