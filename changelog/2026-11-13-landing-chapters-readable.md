# Home: three chapters read as three pillars

The owner found the Code / Motion / AI chapters hard to tell apart. Measured: the gap between chapters equalled the gaps inside one (120 vs 120 at 1024, 96 vs 96 at 390), the numbers were 14–16px at 45% opacity, proof headings (up to 46px) matched or beat the chapter title, and "Start from any site" was a second h2 inside chapter 01.

Now:

- Each chapter opens with a full-width rule after `--site-section`, then a 64/80px numeral. Space inside a chapter is `--site-chapter-inside` (48, 64 from 810px), always smaller than the boundary.
- Proof headings (`ProofPair`, `Features`, `StartSite`) are capped at 22/26/30px, below the 34/40/46px chapter title. `StartSite` is an h3 and stacks below 810px.
- `PillarRail` (`chapters/`): a fixed index, left rail from 1024px, top bar under the header below. `aria-current` follows the section on the viewport's middle line; it shows only while `.chapters` covers the rail (62% line on desktop, under the bar on phones), and on focus. Header and drawer z moved up one step to sit above it.
- "Why not Remotion?" and "Ship it as video or code." left the motion chapter, with `Remotion.svelte`, `CODE_VIDEO`, `code-poster.webp`, `Features`' `children` slot and `ProofPair`'s `flip`. The motion chapter is now intro, steps, the video row, the templates card.

Discarded: a lead-in list (option A) and three cards before the chapters (option C); stills in the PR.
