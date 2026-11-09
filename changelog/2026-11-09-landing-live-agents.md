# Landing homepage built live by agents

The homepage said "made for humans and agents" and showed a static page. Now it starts empty and
about 16 simulated agent cursors (6 on mobile) build it in front of the visitor: navbar first, then
each section as it scrolls into view. Headlines and copy are typed in, blocks get a frame drawn
before they appear, images are resized into place. Once built, agents keep making small reversible
tweaks (font picker, colour swap, nudge, resize, retyping the last words of a line).

Cursor and pill styling copy the canvas presence layer (`PeerLayer.svelte`, `PEER_COLOURS`).

- `landing/src/lib/site/LiveAgents.svelte`: overlay, one rAF loop, per-agent step queues.
- `landing/src/lib/site/live-agents.ts`: roster, typing frames with corrected typos, easing,
  `BUILD_SELECTOR` and the head snippet that hides unbuilt elements.
- Real text stays in the SSR HTML. The hide rule only applies after an inline script adds
  `agents-build` to `<html>`, which never happens with reduced motion. If the component hasn't
  mounted after 4 s, the class is removed.
- Typing mutates the existing text node (`Text.data`), so Svelte keeps its bindings.
  Hidden elements keep their layout box (opacity 0), so the page doesn't shift as it builds.

Discarded: hand-tagging every element (a selector covers nav and every section, outermost wins);
`display:none`/clip hiding, which causes layout shift.

Known cost: hero LCP text is hidden until typed.
