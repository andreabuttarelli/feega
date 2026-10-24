# Fullscreen output viewer

F4 FL-21. `OutputViewer.svelte` (opened by View in the selection bar for an image/video/audio node with output): the output full size, prompt, model, seed, cost from the run's `node_runs` row (`run-info.ts`), prev/next across the node's produced runs (arrow keys), Esc to close, copy params as JSON. Data comes from `data.runs`, already on the page.

- Not done: copy params into the node, compare (next PR).
