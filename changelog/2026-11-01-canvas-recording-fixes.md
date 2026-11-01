# Canvas fixes found while recording videos

Six defects, each with its failing test first.

1. **Page switch drew nothing.** `GpuFlow.adoptNew` keyed the fit on
   `page.params.canvasId`, which changes before the page swaps its rows;
   `tiles` re-derives meanwhile (peer motion), so the fit ran on the old
   page's tiles and was marked done for the new one. The page now passes
   `canvasId` (the canvas its rows belong to, set in `openCanvas`), and
   the fit and saved view key on it. e2e: `canvas-page-switch.spec.ts`.
2. **⇧2 left "GPU renderer unavailable: unreachable".** Reproduced on a
   copy of the imported Linear page, headless at DPR 2: zoom 4 lost the
   GL context, the reattach reused the lost `<canvas>` and the core
   panicked; every backend then failed. Now: the canvas is keyed on the
   attempt (fresh context), a trapped core is reloaded (`dropCore`,
   decided by `afterAttachFailure`), a dead raster's `dispose` cannot
   throw, and `fitView` returns null on non-finite bounds. Not done: why
   zoom 4 exhausts software GL; a 0×0 instance itself was not the cause
   in the copies we found.
3. **Folded rows kept their children after reload.** Folds applied only
   to the open frame; closed frames list a stored outline that ignored
   them. `childRows` now drops rows under a folded key.
4. **Wrap with stack dropped instances.** An imported instance has no
   width/height props; its box is its component's content moved by its
   transform. `shownBox` in `layout/resolve.ts` gives that box and
   `wrapped` uses it.
5. **Typing a stack width slid it off the frame.** `setChildSize` kept
   the stored centre, which for a hugging stack is still its wrap box.
   It now keeps the left/top edge.
6. **Layout W/H were stale.** The inspector read stored props; clips in
   or being a stack now show `laidClip` sizes.
