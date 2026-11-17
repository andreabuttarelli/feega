# Phone GPU budget held live, not only configured

After `2026-11-16-phone-gpu-budget` the phone caps summed to 192 MB, but live textures on the user
canvas copy still peaked at 248 MB after a zoom. Two pools sat outside every budget:
- spare, fallback, ahead, lifted and rest textures, and pooled batch atlases, next to the tile
  pyramid;
- cached effects, with a fixed 256 MB cap that no device setting reached.

Changes:
- `tiles_kept_beside` (`tiles.rs`): the pyramid gets what is left of the tile budget after
  everything held beside it. When over budget, spare tiles, spare rest blocks and pooled atlases
  go first.
- `Engine::set_effect_budget`: cached effects get a device budget and are evicted least recently
  used. Phone 16 MB; desktop keeps 256 MB.
- Phone tile budget 24 MB, down from 64 MB, to leave room for both.
- `tests/perf/phone-gpu-budget.spec.ts`: samples live texture bytes every 250 ms through load
  and zoom on the user canvas copy (iPhone 14, CPU 4x) and fails above 192 MB. It failed at
  247.8 MB before this change.

Measured, user canvas copy:

| | phone peak (spec) | phone load / zoom MB | phone zoom fps | phone TTI | desktop load / zoom MB |
|---|---|---|---|---|---|
| before | 248 | 195 / 241–244 | 51–57 | 10–16 s | 636–828 / 1078–1084 |
| after | 187 | 170 / 185–187 | 49–55 | 11–14 s | 819 / 1075 |

Phone zoom flicker check, 9 runs: 0 dips, 60 fps.

Discarded: unpinning on-screen tiles to meet the budget. Pinned tiles are what keeps a zoom from
flashing blank.
