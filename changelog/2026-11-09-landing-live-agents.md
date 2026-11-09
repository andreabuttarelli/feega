# Landing homepage built live by agents

The homepage said "made for humans and agents" and showed a static page. Now it starts empty and
up to 24 simulated agent cursors (8 on mobile) build it in front of the visitor: navbar first, then
each section as it scrolls into view. Headlines and copy are typed in, blocks get a frame drawn
before they appear, images are resized into place. Each section swarms: roughly one cursor per element,
long lists in small batches, built within ~2 s. When nothing is left to build in view, agents glide
off the nearest edge and the "N agents editing" count drops. Afterwards a rare single tweak (font,
colour, nudge, resize; under 1 s) brings one agent back. A tweak ledger enforces readability: each
element is tweaked at most once, never concurrently, never near the visitor's pointer, at most one
every 3.5 s across all agents.

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

Footer: agents build it like any section. The giant wordmark is the one declared exception, a row
in `ELEMENT_RULES` (`live-agents.ts`): a standing crew of 4 with `TweakLimit.Unlimited` keeps editing
it while it is in view. Beats are retype, font, colour, tracking, resize and select, one at a time,
each settling back to the real wordmark. Every other element falls through to the default row
(`TweakLimit.Once`).
