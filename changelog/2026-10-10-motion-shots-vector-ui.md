# Shot library and real product UI as vectors

The ask: "Fammi un trailer motion di feega.app" produced a static, slow, near-empty video built from
generic UI kit cards (`~/Documents/feega-videos/feega-trailer-test/` v1, v2). The user: "really
ugly"; "the UIs never represent the product". Two decisions: the agent directs by picking
handcrafted shots instead of laying out pixels, and the real product UI is shown rebuilt as live
vectors, never as a screenshot.

## Vector UI (`src/lib/motion/vector-ui/`, `src/lib/server/web/vector-capture.ts`)

- `captureOf` runs in the page (`AppTab.vector`, `vectorOfPage` in `web/browser.ts`, child iframes
  included and offset): every painted box (fill, gradient, borders per side, radius, shadow,
  backdrop blur), every text run line by line (font, size, weight, tracking, colour, gradient text),
  every `<svg>` sanitised (no scripts, external hrefs, images), pictures as `image` nodes.
  Visually hidden elements (sr-only clip, `inset(50%)`) and masked boxes are skipped;
  `visibility: hidden` parents no longer hide visible children.
- `vectorUi` (pure): merges per-letter runs (Framer splits words into letters), names every
  element by role (`input-0`, `button-2`, `heading-0`, `stat-1` for numbers, `icon-3`, `image-0`),
  drops what is off screen, lists pictures in `raster` (flagged, drawn empty). `withinBudget`
  keeps the component under `MAX_JS` dropping icons, pictures and small boxes before any text.
- `vectorPiece` writes a custom component: the UI JSON (`const U = …;`), a seekable runtime
  (`drawVector`, `typeInto`, `pressOn` on the house press spring, `countUp`, `ringOn`) and props
  for those acts. Fonts map to the Google catalogue (`familyFor`, fallback Inter).
- Anchors: `pieceAnchors` reads the exact element boxes, so `focus_ui`/`click_ui` work on them.
- Tool: `recreate_ui` takes `url` (live page) as well as `asset_id` (vision path, unchanged).
  `uiCapture` in `web/live.ts` gives it the same browser as `app_browse` (Browserless or local
  Chromium). The client UI keeps its own corners; the square rule is for our chrome.
- Fidelity, local Chrome, 1280×800, SSIM page vs rebuild: feega app home 0.98, feega editor 0.94,
  linear.app 0.82, feega.app (Framer, iframe hero) 0.81, stripe.com 0.77 (WebGL gradient stays a
  picture; their fonts are not in Google Fonts). Side by sides in
  `~/Documents/feega-videos/shots/ui-fidelity/`.

## Shots (`src/lib/motion/shots/`)

Ten parameterised, deterministic templates, one table (`SHOTS` in `library.ts`): kinetic-title,
device-fly-in, ui-focus, feature-grid, stat-count, before-after, logo-resolve, ui-morph,
tagline-card, whip-zoom. Each has its own camera move, secondary motion, expo easing that settles
without overshoot, holds, a 2–4 s range (whip 1–2 s), and data-only slots validated by zod.
Titles 600, −0.05em, line-height 0.95. The UI shots bake the vector UI in; the logo shot shows the
original asset flat (fade and scale only).

- `add_shot({ shot, slots, ui, at, seconds })`: refuses unknown slots (naming the valid ones),
  element ids the UI does not have (listing those it has), a UI shot without a rebuilt UI, and a
  length outside the range ("cut the words"). Start and end snap to `beat N` markers within 0.3 s
  (`onBeat`). The result is an ordinary `Custom` clip whose slots are props, editable after.
- `list_shots`: id, one line, slots, seconds, preview path (`/motion/shots/<id>.jpg`).
- Peak gate: shots marked `peak` count as the film's peak.

## Gate

- `no-product-ui` (blocking): a film with a script or story markers and no rebuilt UI (vector or
  recreated) is blocked; kit cards do not count.
- Reading time: a line that needs more than 4 s now asks to cut to N words (or split it), never to
  hold longer. v1 held a 9-word line 5.2 s because the gate asked for it.
- `SHOTS_RULE` leads the launch-film rules: direct with shots, recreate the UI from the url first.

Discarded: driving shots through clip keyframes on top of a UI clip (camera, masks and timing
spread over many clips the agent must keep consistent; the shot is the unit the agent picks), and
screenshots as content (they cannot type, press or zoom crisp).
