# Selecting an element no longer crashes the Properties bar

#1100 added flip to the clip bar's base actions, #1101 added it to the
frame structure actions. ClipBar concatenated both, so the keyed each
saw `flip-horizontal` twice and Svelte threw on every element select.
ClipBar now dedupes its actions.
