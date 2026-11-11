# Canvas: no filter passes for empty shadowed groups

Imported landing pages put a CSS drop-shadow (often with a mask) on card groups. When a render
covers only part of a card, the plan culls the group's children outside the render but keeps the
group, because its shadow reach overlaps. The engine then built a layer body for a group with no
items and ran the whole filter chain (alpha, two blur passes, flood, offset, two composites, mask
fold) over the group's region for nothing: about half the filter work on the landings fixture.

Now `prepare` culls a group with no items whose filters are all CSS: CSS filters of a transparent
body are transparent. SVG filters keep the layer (`feFlood` paints without a source).

Measured (landings, CPU 1x, tiles probe, GPU ms to done): zoom 1.5 +4 level 1446 → 761, zoom 0.5
+4 level 697 → 361, one screen at zoom 1.5 399 → 217. Settled screenshots, tiles off and on, zoom
0.12/0.5/1.5/4: max channel difference 1.

Open, not changed here: the culled children's shadow tails are already missing where they would
reach into a render that does not contain the child (tile and screen edges).

Gestures (landings, CPU 1x, 2 interleaved runs, fps / p95 ms): tiles off zoom 12–13 / 401–418 →
20–22 / 168; tiles on unchanged (zoom 57–58 / 18.5), time to sharp 2.6 → 2.2–2.3 s. Load bench
within noise both ways.
