# Comparison pages on the marketing site

The landing site had no blog and no page answering "Feega vs X", the query people type when
they have picked a category and are choosing a tool. Added `/blog` and four head-to-head
pages (Jitter, Remotion, After Effects, Rive), following PostHog's comparison content guide:
say where the competitor wins, a "who should pick them" section, sources and a check date on
every page, and no "sort of" cells.

Every competitor lives in one data file (`landing/src/lib/site/compare/tools/*.ts`) against
shared feature keys (`features.ts`); Feega's answers are in `feega.ts`, so a Feega feature
that ships changes every table at once. `compare.test.ts` fails if a page skips a row, has no
sources or no date. Pages are prerendered, listed in the sitemap and llms.txt, and linked
from the footer.

Prices are described, not quoted: Jitter's and Remotion's amounts could not be confirmed on
their own pages. Figma as a competitor was left out: its motion is prototype transitions,
not a timeline, and the page would be a straw man.
