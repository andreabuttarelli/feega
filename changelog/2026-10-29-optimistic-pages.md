# Pages and canvas sharing run through the optimistic runner

New page, rename, delete waited for `submitCanvasAction` (post, then `invalidate`) before the
Pages list changed; the canvas share toggle waited for the server to mint the token before the
link appeared.

Now they are rows in `src/lib/canvas/page-ops.ts` over one state (pages list + written share)
held by `canvasPages` (`canvas-pages.svelte.ts`), shared by both `PagesList` instances and the
layout. Id reconciliation is avoided by letting the client choose:

- new page: client uuid, `new_canvas` stores it (`id`); the name is predicted with
  `nextCanvasName`, moved to `$lib/canvas/canvas-names.ts`. The page opens after the insert
  lands (opening it earlier would load a canvas that does not exist yet).
- delete: the row leaves and the app goes to the next page at once.
- share: the client mints the token (`mintShareToken`, moved to `$lib/canvas/share-token.ts`);
  `setCanvasShare` keeps a well-formed one (32 base64url chars) and mints its own otherwise.

Once the queue is idle the list is re-read (`invalidate(app:canvases)`) and the local overlay
dropped. A refusal restores only the touched page or the share, with a notice in the Pages panel.

Not converted: the doc node share toggle (its token is hashed server-side).

| Action | Before | After (server delayed 2 s) |
|---|---|---|
| New page (row shows) | 1280 ms | 16 ms |
| Rename page | 516 ms | 3–15 ms |
| Delete page | 1056 ms | 3–22 ms |
| Share canvas (link shows) | 249 ms | 2 ms |
