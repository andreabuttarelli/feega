# Import fidelity, round 2 (traidue.com)

- **Nested instance offset** (`linked-mains.ts` `innerKept`): when mains follow
  their home frame, the outer main is shifted to its local place; an instance of
  another main inside it took that shift too, while the inner main was anchored
  back to its own local place, so its content drew one shift off (2045 px on
  traidue: the navbar search input over the nav links). The nested host now
  gives back the inner main's anchor shift. The TS display list of the stored
  doc was correct; the error was in the doc the server serves after linking.
- **List markers** (`page-tree.ts` `listMarkers`): `::marker` is unreadable, so
  outside disc/circle/square/decimal markers get a stand-in text.
- **Rounded clip** (`page-tree.ts`): an unpainted `overflow:hidden` box with a
  radius stayed a group and lost the corners of its image; it is now a clipping
  frame.
- **Badge**: no longer clipped after the precision fix of round 1; no change.
- **Home 100 px short**: not an importer defect. The hero uses
  `min-h-[calc(100svh-3.5rem)]`; the importer renders at 1280×800, the reference
  shots were at 1280×900. The check now shoots the site at 1280×800.
- **Stable check**: `freeze-random.mjs` (in the shots folder, not the repo)
  reseeds `Math.random` per HTTP request, loaded via `NODE_OPTIONS` into both
  the reference dev server and the importer's, so shuffled article lists match.
