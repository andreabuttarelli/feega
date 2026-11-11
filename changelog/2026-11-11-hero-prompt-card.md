# Hero prompt as a tabbed card

The landing composer is restyled as one floating card: kind tabs with icons on top, an inset
input with sources and attach bottom-left, a static "Opus 5.5" label and a round send button
that turns orange with text. Each kind has its own placeholder (`PROMPT_KINDS.placeholder`).
Icons are lucide paths inlined in `prompt/Icon.svelte`: `landing/` has no lucide dependency,
and lucide dropped its brand glyphs, so GitHub and Figma use git-branch and frame.
On phones the card is full width and sources collapse to icons. Handoff is unchanged.
