# Embed inside a site builder's iframe

**Before:** Framer/Webflow/Wix/Notion put the pasted snippet in their own fixed-size iframe.
The loader left the document's 8px body margin, sized a scrub embed at `100vh` inside a
`3×100vh` sticky section the frame could not scroll: the video sat inset, cropped at the bottom,
and the scrub never moved.

**Now:**
- A stylesheet gives `feega-motion,[data-feega]` `display:block;width:100%;height:100%` (tag
  specificity: the page's own CSS wins).
- When the element is the only content of its document (scripts aside), the loader sets
  `html,body{margin:0;height:100%}`. Never on a normal site.
- The scrub source comes from one table, `SCRUB_SOURCE` in `loader.ts`, keyed on `HostKind`:
  top page → sticky story; same-origin frame → `hostMain` on `window.parent`, measuring
  `frameElement`; foreign frame (sandboxed srcdoc, other origin) → the loader posts
  `{gesture:true}` and the player scrubs by wheel/drag with momentum (`gestureScrub`), letting
  the page scroll once the timeline hits an end.
- No story → no `100vh` fallback; the aspect ratio is used.

**Discarded:** a focal point for the cover crop (the composition carries none); `fit="contain"`
already exists for very off-ratio boxes.
