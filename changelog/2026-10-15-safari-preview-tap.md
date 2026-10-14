# Safari preview at 60 fps after a tap that pauses it

Safari plays and scrubs the editor preview at 30 fps, Chromium at 60. WebKit (changeset 215070)
adds `NonInteractedCrossOriginFrame` to the rAF of a cross-origin frame whose own document never
handled a user gesture; only a real input event dispatched into that document lifts it
(`UserGestureIndicator` → `Document::updateLastHandledUserGestureTimestamp`, which walks up to
ancestors, never down). Rendering is not throttled, only rAF callbacks.

#594 lifted the frame above the overlays until the first press and replayed it as synthetic
events: pen, drag and selection broke (reverted in #596). This version never takes a press the
overlays use. While playing, the overlays are unmounted and `play-catch` only paused and picked
the clip under the press; now the frame itself takes that press (`listenTap`, `frame-tap.ts`),
posts its point, and the shell runs the same pause-and-pick (`catchAt`). From that tap on, the
document plays and scrubs at 60 in WebKit until the next srcdoc reload. Not armed for interactive
previews (`live`), whose pad needs the pointer.

Checks on the message: only from the frame's window, only while
`navigator.userActivation.isActive`, point clamped to the frame. Sandbox (`allow-scripts`, opaque
origin) unchanged: `editor-scrub-sandbox.spec.ts`.

WebKit, `editor-scrub-budget.spec.ts` (inner rAF fps avg / p5): play and scrub 30 / 29 before,
60 / 56 after the tap; guard at 55.

Real stack (chromium, test account): `editor-preview-press.spec.ts` (first press selects, first
press drags, press while playing pauses and selects) plus canvas-bottom-bar, canvas-draw-polish,
canvas-fills, canvas-draw-tools, canvas-move-elements: 18 passed. The motion editor has no
marquee. `motion-editor.spec.ts`, `motion-touch.spec.ts` and `auto-layout.spec.ts` fail the same
30 tests on dev without this change (stale selectors, e.g. the "Add" button).

Limit: the first playback after a load stays at 30 in Safari until the user taps the preview.

Discarded: focus (30 / 28), gesture forwarded by `postMessage` (30 / 29), hover (30 / 29),
host-driven seeks (paint 60 but `renderSeek` pauses the runtime and its audio), WAAPI (runtime
is GSAP on rAF), first-press passthrough with replay (#594, broke editing).
