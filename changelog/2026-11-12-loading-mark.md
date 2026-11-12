# The mark on the canvas loading screen

The loading screen showed the wordmark alone above the progress bar.
The mark now sits above it, in both layers: the static splash in
`src/app.html` (inline SVG, same lobe path as `FeegaMark`, since it
paints before any script) and `CanvasLoading.svelte` that replaces
it. Same size and gap in the two, so the handover does not shift.
