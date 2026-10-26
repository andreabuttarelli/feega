# Landing homepage follows the new Framer site

**Before:** the SvelteKit homepage still mirrored an older Framer page: a motion screenshot,
a 21-video showcase grid and a "Much more than just motion" discipline picker.

**Now:** after the hero (title, overview video, agent prompt and cloud CTAs, unchanged) the page
follows feega.app: a floating image/video collage, "One tool for the entire creativity process"
(three cards), "If you can imagine it" (eight tilted cards, desktop only), the interactive
motion under "Your design tool shouldn't limit you", then models, pricing, agents and FAQ.
Instrument Serif joins the font set (latin subset) for the tilted cards. The collage is one
table in `home.ts` (`COLLAGE`), positioned on a 1440x900 stage in `cqw` so it scales.

**Fixed:** `<pre role="tabpanel">` in the agents block (a11y warning) is now a focusable
`div role="tabpanel"` around the `pre`.

**Discarded:** porting Framer's scroll-pinned hero animation (the hero from #1356 stays first);
porting Framer's FAQ, which is the old copy and contradicts the open-source and local-mode facts.
Removed: the showcase grid, the screenshot block and the discipline picker with their assets.
