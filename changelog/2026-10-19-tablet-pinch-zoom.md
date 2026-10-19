# Pinch on a tablet zooms the canvas, never the page

**Why.** On iPad Safari a pinch zoomed the whole page (bars, controls). The lock set
`touch-action: pan-x pan-y` only on `<html>`; scroll containers (chat log, bars) escaped it, and
iOS ignores `user-scalable=no`. Pinch gestures over the canvas were also applied twice: by the
canvas's own pointer pinch and by the forwarded `gesturechange`.

**What.** `lockPageZoom` marks `<html data-page-zoom-locked>`; `app.css` gives every element
`pan-x pan-y` at zero specificity, so surfaces declaring `touch-action: none` keep it. A
two-finger `touchmove` is cancelled at capture. `gesturechange` reaches the canvas zoom only
outside surfaces that own their pinch (`data-owns-pinch` on GPU canvas and editor `ZoomStage`,
`.svelte-flow` for the DOM canvas): one selector, in `page-zoom.ts`. The 16px input rule now
applies on `any-pointer: coarse`, so an iPad with a trackpad still avoids focus auto-zoom.

**Tests.** `page-zoom-lock.spec.ts` on a new `webkit-ipad` project (iPad Pro 11, same `@real`
gate as the other webkit projects).
