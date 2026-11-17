# Local mode resizes each image size once, two at a time

`/local/storage/...?width=&height=` ran a sharp resize to webp on every request, uncached and with
no limit. Opening the 36-page stress canvas asked 578 `?size=256` tiers within seconds, on the same
Node process that parses frame sources: a two-frame `/motion/sources` request then took ~6 s.

`resizedOnce(transformed, 2)` keeps each bucket/path+size result (bounded at 4000 entries, dropped
when the path is written again) and runs at most two resizes at once; originals skip it. Not done:
keeping tiers across restarts (a sidecar cache next to the .feega file).
