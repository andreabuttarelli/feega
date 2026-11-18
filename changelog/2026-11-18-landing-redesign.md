# Landing: lowercase copy, local vs cloud pricing, /pricing page, shorter page

Owner choices, made in review on localhost:5871.

- Copy is lowercase except proper nouns, acronyms and product names. Done in text, not CSS:
  `landing/src/lib/site/lower.ts` (`PROPER_WORDS`, `PROTECTED_PHRASES`, pinned by `lower.test.ts`).
  Data-driven text goes through `lower()` at render, so meta, OpenGraph, JSON-LD and llms.txt keep
  their casing. Legal pages, code and URLs untouched.
- Titles one weight lighter: `--site-title-wght: 400` via `font-variation-settings` (the root's
  `wght` 500 overrides `font-weight`, so editing `font-weight` did nothing). Hero h1 stays Instrument Serif.
- Pricing is local vs Feega Cloud (dusk.bot-style), one `PriceGrid` component used by the homepage
  and the new `/pricing` page; rows aligned across columns with a shared grid. "Plan details" only on /pricing.
- New "for local use, Feega is free" section: the big word uses the hero h1 style, in the accent orange.
  "personal use" was dropped: Apache-2.0 allows commercial use, so the site cannot promise otherwise.
- One FAQ (8 questions, data in `home.ts`) under the pricing grid on both pages; one FAQPage JSON-LD per page.
- Removed: the agents/MCP section (setup now lives in docs), the estimator, the credit-rules block
  (facts moved into the FAQ), the homepage FAQ, the founder story section, and the how-it-works
  section tried today. Removing an editor not being refunded is no longer stated on the site.
- Footer: brand block with social icons on the left, links split into product / learn / legal,
  responsive grid with no horizontal overflow from 320 to 1600 px.
- Hero ASCII field darker (alpha 0.2–0.5, was 0.3–0.75) with a stronger shade behind the title, for readability.
