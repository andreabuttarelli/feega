# Docs guides show a video of each feature

Why: the guides in `web-docs/` described features in text only; the demo
videos recorded for socials were not where people read how to use them.

Now: eight demos, re-encoded (H.264, faststart, 1280 px, CRF 30, no audio,
8 MB in total with posters), live in `web-docs/public/videos/`. One
component, `DemoVideo.astro`, embeds each at the top of its guide: muted,
looping, `playsinline`, `preload="none"`, poster, and it plays only while
on screen.

Pages that embed one became `.mdx`. Search and colour tags had no guide, so
`canvas/search-and-colour-tags.mdx` is new. Shapes holds two videos
(rotate-corners, auto-width-text).

Discarded: the 9:16 cuts (docs layout is wide) and hosting in the `media`
bucket (size is small enough for git).
