# Feega demo is the hero video

The hero showed the old canvas video. It now plays a 25 s screen recording of Feega editing
this landing: select the headline, font-size scrub, per-side padding, Phone and back, palette
colour, Changes → diff, then ⌘Z reverting the colour. One video on the home; the separate
section under the hero is gone.

- Recorded with the real webview and host edit code against a copy of `landing/`, driven by
  Playwright through `scripts/demo-record/` (camera zoom per click and typing), in a
  VS Code-like window titled "landing — Feega". The diff view is drawn from the real
  before/after file. Colour moved last so the final undo visibly reverts it.
- `landing/static/video/feega-demo.*`: MP4 H.264, WebM VP9 (preferred when supported), WebP
  poster (preloaded). `HeroVideo.svelte`: lazy-played via `lazyPlay`; with
  `prefers-reduced-motion` only the poster shows, with a play button. Radius `md` (6px).
