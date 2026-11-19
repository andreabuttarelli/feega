# Feega Inspect video on the home page

The home page described the extension in words only. A 25 s screen recording now sits under
the hero: select the headline, palette colour, font-size scrub, per-side padding, Phone and
back, Changes → diff, undo.

- Recorded with the real webview and host edit code against a copy of `landing/`, driven by
  Playwright through `scripts/demo-record/` (camera zoom per click and typing), in a
  VS Code-like window. The diff view is drawn from the real before/after file.
- `landing/static/video/`: MP4 H.264 (~5.4 MB), WebM VP9 (~3.5 MB, preferred when supported),
  WebP poster. Lazy-played via `lazyPlay`; with `prefers-reduced-motion` only the poster shows,
  with a play button.
- Radius `md` (6px, card) per DESIGN.md; width capped at the hero's 1100px.
