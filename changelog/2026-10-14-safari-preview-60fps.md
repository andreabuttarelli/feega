# Safari preview at 60 fps: the first press goes to the frame

Safari played and scrubbed the editor preview at 30 fps; Chromium at 60. WebKit
(changeset 215070, `Document::requestAnimationFrame`) adds
`ThrottlingReason::NonInteractedCrossOriginFrame` to a frame whose origin differs from the top
and whose document has no user gesture. Only `Document::updateLastHandledUserGestureTimestamp`
lifts it, and `UserGestureIndicator` calls it on the document that handled a real input event
and on its ancestors, never on child frames. The preview is `sandbox-origin="opaque"`, the
player sets `pointer-events: none` on the iframe and our overlays take every press: the frame
never saw a gesture.

Only `requestAnimationFrame` callbacks are throttled, not rendering: host-driven seeks already
painted at 60 (ResizeObserver counter in the srcdoc probe, `innerPaints`).

`armFirstTouch` (`hyperframes/first-touch.ts`), armed by `MotionPreview` on every `ready`
(each new document starts throttled): the frame is lifted above the overlays with
`pointer-events: auto`; its srcdoc script posts the press (down/move/up, as fractions); the host
lowers the frame and replays the press as synthetic pointer/mouse events plus `click` on the
element under the same point. Accepted only from the frame's window, only while
`navigator.userActivation.isActive` (a real gesture), point clamped to the frame, one press.
The sandbox (`allow-scripts`, opaque origin) is unchanged: `editor-scrub-sandbox.spec.ts`.

WebKit, `editor-scrub-budget.spec.ts` (inner rAF fps avg / p5):

| | before | after first press |
|---|---|---|
| play | 30 / 29 | 60 / 56 |
| scrub | 30 / 29 | 60 / 56 |

Discarded, WebKit numbers:
- `iframe.focus()` after a host press, then a key: 30 / 28. Focus is not a gesture.
- Host gesture forwarded with `postMessage`: 30 / 29. The forwarded token never updates the
  target document's timestamp.
- Hover over an interactive frame: 30 / 29. Mouse moves are not gestures.
- Host-driven playback (host rAF sends a seek per frame): paints 60 / 53, but `renderSeek`
  pauses the runtime, so audio stops.
- WAAPI/CSS playback: not tried; the runtime is GSAP on rAF.

Cost: until the first press the frame takes hover, so overlays show no hover highlight.
