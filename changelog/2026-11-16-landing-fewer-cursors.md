# Landing: per-section cap on roaming cursors

Pricing, FAQ and footer showed several cursors at once, over text the
reader is reading. The global pool (24 desktop, 8 mobile) is unchanged: a
second table in `live-agents.ts` (`SECTION_CAPS`) caps how many cursors may
target elements of a section: `#pricing` 1, `#faq` 1, `.site-foot` 1.
`.site-foot .mark` keeps its crew of 4 and is outside the footer count.

Elements matching `PROTECTED_SELECTOR` (buttons, links, summaries, price) in a
capped section are no longer targets, so no cursor rests on them.

Discarded: lowering the global count (thins hero and every other section).
Known effect: FAQ has no tweakable target left except its title, so its
cursors mostly disappear.

Tests: `section caps` in `live-agents.test.ts`.

Second pass: `#pricing` also has `restMs`. After a cursor leaves, no other
may enter for that long, and a cursor still flying out of a section counts
as present (`holders`, `noteOccupancy`, `mayEnter` gate). Before, one
cursor leaving while another arrived showed two at once.

Third pass: elements in a capped section are never hidden waiting for a
cursor (`mayHide`). Below-the-fold elements elsewhere still are; with the
rest period, pricing would otherwise stay blank for the whole visit.
