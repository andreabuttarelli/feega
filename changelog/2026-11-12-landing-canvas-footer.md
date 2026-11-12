# Landing: the home ends as a frame on the canvas

The home used to end on a plain footer. Now the last stretch of scroll zooms the footer out until
it sits as a frame on a replica of the canvas editor, with the editor chrome around it. The page
is the product's demo of itself.

**How it moves.** `CanvasEnding.svelte` wraps the footer on `/` only. An empty spacer (75svh)
sits before the footer, which is `position: sticky; bottom: 0`: it scrolls in like a normal
footer, sticks at the viewport bottom, and the spacer's height is the zoom's runway. An absolute
`.runway` marker at the bottom carries a `view-timeline`; every animated piece has the class
`scrub` and runs over `entry-crossing 0–100%` of it. Without scroll timelines (Safari < 26,
Firefox) the same keyframes run paused with `animation-delay: calc(var(--p) * -1s)`, and a
passive scroll listener writes `--p` once per frame. One set of keyframes, two drivers. Under
`prefers-reduced-motion` the spacer is gone and the footer is plain.

Document height never changes while scrolling: the spacer is in the SSR markup and sized in CSS.
The end pose (`endPose` in `canvas-ending.ts`) is measured on resize only and lands on a whole
percentage, so the zoom readout (an `@property` integer shown through a CSS counter) is the real
scale.

**What it mirrors** (replicas, not imports — the landing cannot import the app):

| Fake surface | Product source |
|---|---|
| canvas background, dot grid | `GpuFlow.svelte` (`--ui-canvas`), `canvas/dot-grid.ts` |
| top bar pills, project switcher, Connect, peers, credits, Share, view, chat | `CanvasTopBar.svelte`, `CanvasMenu.svelte`, `CanvasShare.svelte`, `PeerAvatars.svelte`, `ViewMenu.svelte` |
| rail | `FloatingRail.svelte` |
| Pages + Layers panel | `CanvasLeftPanel.svelte`, `PagesList.svelte`, `LayersPanel.svelte` |
| Properties panel | `RightBar.svelte`, `MotionInspector.svelte`, `InspectorSection.svelte`, `NumberField.svelte`, `FillStack.svelte` |
| add bar | `CanvasAddBar.svelte`, `canvas/bottom-bar.ts`, `GenerateBadge.svelte` |
| frame label, element selection | `canvas/core/chrome.ts`, `label-size.ts`, `FrameSelection.svelte` |

Icons are copied from `@lucide/svelte` 1.21 (`canvas-icons.ts`). The menu button shows the logo
mark and a chevron, the look the app is moving to.

The zoom readout lives next to the eye in the top bar; the product shows zoom only inside the View
menu. That is the one invented detail.

**Links at the end state.** At 52% the footer links are about 11 px tall: clickable, not readable.
A second, readable footer was rejected (two footers for screen readers), and so was counter-scaling
the link rows (they no longer fit the frame). Instead the frame opens like a frame in the editor:
a click on it (anywhere but a link) or keyboard focus entering it scrolls back to where the zoom
starts, so the footer is at 100% with the focused link in view (`openScroll`). The cursor reads
`zoom-in` over the frame. Links keep working directly at every scale; a mouse click on a link never
triggers the scroll (only `:focus-visible` does), so it cannot cancel the click.

**Agents.** The live agent cursors keep working on the footer inside the frame, as busy as on the
rest of the page; they are `pointer-events: none`, so they never take a click. They skip targets
hidden by `visibility` (the site header hides during the ending, so they no longer park on it).
A two-cursor version was tried and dropped: the busy canvas reads better.

Rejected: scaling the whole page (a 12 000 px layer, fixed elements break under a transformed
ancestor); a duplicate, already-zoomed footer (two footers for screen readers); changing the
footer's height during the animation (that is what made the page scroll by itself before).
