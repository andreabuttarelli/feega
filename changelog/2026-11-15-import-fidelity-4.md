# Import fidelity round 4 (traidue.com)

- **Type size floor** (`type-units.ts` TYPE_SIZE.min 0.001 → 0.0001): sizes are
  relative to the frame's short side, so on a 16000 px board the old floor was
  16 px and every smaller label came in at 16 px.
- **Margined link at a line start** (`page-tree.ts`): the link's left margin
  moved that line's edge, the paragraph split into one text per line, and on the
  canvas the fixed lines wrapped on their own and overlapped ("Approfondisci").
  Line edges now allow for margins inside the run.
- **SVG above the page top** (`page-tree.ts` `vectorOf`): the box was cut at
  the top while shapes kept the uncut origin, so Leaflet map land drew lower
  (/servizi). Shapes now use the kept box.
- Map halos (two stacked box-shadow rings): not changed; small cost.
- Harness: canvas shots wait for network idle (image tiers loaded late made some
  shots blurry and scores vary ±0.02); stitched wiki parts are aligned one by one.
