# Collage stack template

Built-in `builtin:collage-stack-rotate`: up to 10 cards (photos and white prints) slide in one by
one from off-frame, each landing at its own angle; every landing nudges the cards below by a
degree and sinks them slightly, so the pile reads as a collage being built. Behind: a huge
outline word marching once per loop along the long side; in front: a thin line grid with small
monospace labels (fictional ID / CREATED BY / SAVED BY, from a "creator, @saver" list).

Decisions:
- CSS only, expo in-out moves, nudges turn the same way as the entrance (no reversal, no overshoot).
- Loop: top cards leave first, labels and lines retract; t=0 and t=end are the empty red frame.
- Card table traced from a portrait reference; unit = min(width, 0.6·height) keeps it in frame in
  16:9 and 1:1.
