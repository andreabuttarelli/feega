# Word wheel UI template

A built-in motion template: a fixed word plus a slot-style wheel of words
(the centred one lit in the accent, others dim) on a dark green glow, while
a tilted dashboard panel glides in from the right in CSS perspective.

- CSS only, pure function of t; wheel turns one full round so the loop closes.
- Words wrap top→bottom only while invisible (tested); moves are expo in-out, no overshoot.
- Panel is a vector UI of a fictional brand (Norvia); an optional picture or video replaces its main column.
- No sample-table row in `scripts/component-previews.ts`: the default preview is the vector panel, a sample photo would misrepresent it.
