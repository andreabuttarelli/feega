# Effect LOD table: tiny layers drop their effects

`lod::PLAIN_BELOW_PX` gives one floor per effect kind:

| effect | floor (on-screen extent) |
|---|---|
| backdrop | 16 px |
| mask, matte, filter, blur | 4 px |

`groups::softened` applies the table to each placed item. Below the floor an item draws its plain
fill instead of paying a separate vello render for the effect.

Landings-wall bench, compared with #2170:
- worst frame: 101 → 85 ms
- frames over 50 ms: 19 → 10
- blur per leg: unchanged at 1.4–1.7 s

Per-render counts fell only ~10%, because most effect layers at overview are larger than these
floors. ADR 0039 records the target design: a magnification cap plus a native LOD scene, which is
not built yet.
