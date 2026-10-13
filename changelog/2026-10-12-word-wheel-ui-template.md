# Word wheel UI template

A built-in motion template: a fixed word plus a slot-style wheel of words
(the centred one lit in the accent, others dim) on a dark neutral glow, while
a tilted app panel glides in from the right in CSS perspective.

- CSS only, pure function of t; wheel turns one full round so the loop closes.
- Words wrap top→bottom only while invisible (tested); moves are expo in-out, no overshoot.
- Panel is a white-label vector UI: placeholder circle mark, "Your app", greyscale palette (all fields). No real or invented brand; a test guards it.
- `features` (one per line: `word | screen title | items`) drives both the wheel and the panel: each feature has its own screen (tiles, toggles, chart in rotation) that swaps with the wheel turn, expo in-out. Model exposes `screen { from, to, mix }`, derived from the same `turned` as the wheel so they cannot drift.
- Dropped `words`, `user`, `kicker`, `headline`, `menu`: one list replaces them.
- An optional picture or video replaces the panel's main column.
- No sample-table row in `scripts/component-previews.ts`: the default preview is the vector panel, a sample photo would misrepresent it.
