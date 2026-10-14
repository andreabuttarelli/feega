# Layers: every frame unfolded, posters with their parts

**Before.** #505 listed closed frames from a batched `frame-outlines` read, but in production
no frame showed children unless it was the open one. The read worked (200, rows in the body):
the Layers `{#each}` keyed rows by `nodeId + id`, and a composition played by two clips lists
its insides twice with the same ids. Svelte threw `each_key_duplicate` and the tree stopped at
the node rows. Test docs never reused a scene; real canvases do.

**Now.**
- `LayerRow.key` is the row's path (`clip/track/clip#part`), unique in the tree; the panel keys on it.
- Frames unfold by default; a chevron folds one, kept per frame in `localStorage` (`layer-folds.ts`).
- Closed posters list their parts. Part ids exist only in the rendered DOM (`data-part`, set by
  each template's JS), so the server cannot derive them without running component code. The panel
  renders one closed poster at a time in a hidden `PartsProbe` (preview endpoint + player +
  `measure()`), then asks `frame-outlines` again with `parts=` so labels come from the doc.
  Probed once per revision.

**Discarded.** Running template JS on the server (linkedom): executes user/agent-authored code.
A per-template part registry: duplicates every view's markup and drifts.

**Proof.** `tests/e2e/layers-closed-frames.spec.ts` (four frames incl. a reused scene and a
poster; fold survives reload), red before each fix.
