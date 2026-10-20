# The right bar's Properties tab scrolls

On the canvas the inspector could not be scrolled: sections below the fold were unreachable.

Cause: `SideColumn.svelte` moves the properties pane into the right bar (`portalInto`). Its flex
rules were `.docked .pane`, which need `.docked` as a DOM ancestor; after the move the pane was
`display: block`, grew to its content height (1920px) and `RightBar`'s `.pane { overflow: hidden }`
clipped it. `.props` (`overflow-y: auto`) never got a bounded height.

Fix: `.pane.in-bar` carries its own flex column and `min-height: 0`. `.props` also gets
`overscroll-behavior: contain` so a wheel or touch drag at the end of the list does not chain to
the canvas.

Test: `tests/e2e/right-bar-scroll.spec.ts` (1280x700): the wheel over the bar scrolls it without
moving the canvas, and the last section ends inside the panel and can be clicked.
