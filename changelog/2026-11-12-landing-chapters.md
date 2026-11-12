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
