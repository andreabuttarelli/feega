# Landing: the home in three chapters

The home talked about motion and AI generation in scattered pieces (a video ticker in the hero, a
three-card row, "Why not Remotion?", a black "providers / ship it" block) and only the codebase
feature had a section built to explain it. It now reads as one story: what Feega is, three
chapters, how to plug in an agent, price, who made it, FAQ.

- **Hero**: the line under the title says what Feega is ("an open-source canvas to design, animate
  and generate"). The video ticker moved to the motion chapter, where it is proof.
- **Open source strip**: same words, set at section-text size instead of a 58 px headline.
- **01 Design directly in your codebase**: the approved chapter, now with "Start from any site" as
  its proof.
- **02 Animate any layout**: new isometric loop (layout layers over a timeline; a playhead sweeps,
  keys light up, the layers move, a video tile lifts out), three step glyphs, then the ticker,
  "Ship it as video or code" and the templates card beside "Why not Remotion?".
- **03 Generate on the canvas**: new loop (a prompt node wires into an image node and a video node;
  each result drops onto its node), three glyphs, then "Switch between different providers" and
  the generation and agents cards.
- **Let your agents do the work** comes before pricing, and its headline drops to the chapter scale.

All chapters share `chapters/Chapter.svelte` (copy, steps, art and glyph snippets, box side) and
`iso/` (projection, `Slab`, `GlyphFrame`, in-view pause). Box sides alternate right, left, right.
Links: motion goes to the existing guide `/guides/animate-ui-with-ai-agent`, generation to the
existing `/ai-node-editor`; no new pages.

The live agent cursors used to park on the codebase chapter, cover its button and swap its fonts.
Chapter copy is no longer an agent target, and chapters sit above the cursor layer
(`--site-z-chapter`), so a passing cursor slides under them.

Rejected: a dedicated motion page (the guide already covers layout → keys → export), splitting
the three cards into three components (one `Features` with a card list is enough).

No public changelog entry: the product did not change.

## Follow-up: section rhythm and a moving video strip

- One spacing token, `--site-section` (96 / 120 / 160 px at 390 / 810 / 1200), now sets every
  section break on the home: open-source strip, each chapter, the gap after the last chapter
  (before, the generation cards touched the grey band), agents, pricing, story and FAQ tops.
  Pricing was 200 / 154 px, chapters 200 px, open source 160 / 140 px.
- The 20 motion videos are two rows that scroll on their own in opposite directions (CSS
  transform over a doubled track, faded edges). They pause on hover, focus and off screen. A
  touch, a horizontal wheel or keyboard focus hands the row to native scrolling with snap; with
  reduced motion the rows never move and the duplicates are hidden. Videos keep `lazyPlay`:
  only the ones visible inside the row load and play (8 of 40 at 1440).

## Follow-up: the new logo mark in nav and footer

`Mark.svelte` draws the four-lobe mark inline (`MarkTone.Orange` or `MarkTone.Mono`, a size
prop). The nav's white "Feega" chip now leads with the orange mark; the footer puts a 28 px orange
mark beside the copyright, under the orange wordmark. The live agents no longer take the brand
chip (`.bar > a:not(.brand)`). Favicon, apple-touch icon and OG images still carry the old logo:
not part of this change.
