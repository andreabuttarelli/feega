# Landing: per-section cap on roaming cursors

Pricing, FAQ and footer showed up to two cursors at once each, over text the
reader is reading. The global pool (24 desktop, 8 mobile) is unchanged: a
second table in `live-agents.ts` (`SECTION_CAPS`) caps how many cursors may
target elements of a section: `#pricing` 2, `#faq` 1, `.site-foot` 1.
`.site-foot .mark` keeps its crew of 4 and is outside the footer count.

Elements matching `PROTECTED_SELECTOR` (buttons, links, summaries, price) in a
capped section are no longer targets, so no cursor rests on them.

Discarded: lowering the global count (thins hero and every other section).
Known effect: FAQ has no tweakable target left except its title, so its
cursors mostly disappear.

Tests: `section caps` in `live-agents.test.ts`.
