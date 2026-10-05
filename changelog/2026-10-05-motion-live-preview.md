# Motion preview: patch in place instead of reloading

**Before.** Every edit recomposed the HTML and, after a 250 ms debounce, reset the iframe
`srcdoc`: runtime re-init, blank frame, `ready` cycle. Measured in a real browser (Title clip,
opacity slider, 8 edits): **~288 ms per edit**, always `reload`; while dragging, nothing moved
until the pointer stopped.

**After.** `previewDriver.update()` compares the old and new page with `hotPatch()`
(`hyperframes/hot.ts`). When everything outside `#root`'s layers and the `data-hot` scripts
(timeline, shapes) is identical, it posts the new layers and scripts; the page's hot runtime
clears the existing engine timeline, swaps `#root`, re-runs the scripts in a block scope (the
CSP has no `unsafe-eval`), refits text and seeks back to the same time. Same test: **4–7 ms per
edit**, `patch` every time, and a screenshot after the patch matches one after a full
reload.

Anything else (length, fonts, format, assets) still reloads, debounced. Pages with 3D,
compositions, a camera stage, custom components or particles carry no hot markers and always
reload: their scripts hold references to layers and WebGL state that a re-run would leak.

Export, agent frames and checks still load the full page, so renders are untouched; the
determinism tests stay green. Guarded by `hot.test.ts`, `preview-driver.test.ts` and the e2e
"cambiare l’opacità non ricompone".
