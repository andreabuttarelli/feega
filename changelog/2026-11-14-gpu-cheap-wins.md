# Cheap wins from the 2026-11-14 engine profile

Four per-frame costs the profile named, fixed one commit each (numbers in the PR).

- **FxHash.** Std SipHash showed on the encode path. The scene maps, picture shelves, tile
  textures, layer cache and the vendored vello encoding caches (image, glyph, ramp) are now
  `FxHashMap`. `Pictures`/`Shelf` aliases lose `new()`: use `default()` / `from_iter`.
- **Tile keys.** `keys_over` returned a `Vec<TileKey>`; `covered_within` and `shown_sharper` built
  one per step per missing tile per frame. It is an iterator now; only `lifted_keys` collects.
  Chosen over a cache keyed by (level, rect): nothing to invalidate.
- **Bind groups.** A frame composites tiles twice (placed, lifted). Each pass discarded the other's
  bind groups, so every tile was rebound each frame. `Reprojector` keeps the last two passes'.
- **`set_overlay`.** `OverlaySeen` remembers the last bytes per overlay part; identical bytes skip
  the JSON parse and the group rebuild. Exact byte compare, not a hash: a collision would leave a
  stale overlay on screen.
