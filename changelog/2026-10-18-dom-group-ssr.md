# DOM canvas: a canvas holding a group no longer answers 500

Found by the fluidity scorecard's after-reload check: once a session had made a group, every load
of the canvas with `?renderer=dom` showed "Something broke on our side". `CanvasFlow.svelte`
declared `GROUP_BEHIND_Z` below `toNode`, which the server render already calls for a group tile
(`behind: true`): a temporal dead zone, so only canvases with a group crashed.

The constant now sits above `toNode`. Guard: `canvas-dom-group-ssr.spec.ts` seeds a group and loads
the DOM renderer (500 before, 200 after).
