# Snapshot detail on zoom settle

Snapshots are shot once at 2x, so zooming past ~1.25x/DPR showed them soft.
After the view rests 200 ms, visible snapshot tiles get detail cells shot at
zoom x DPR (steps 2/3/4/6/8). Cells are at most 4096 device px, only around
the viewport (`detail-plan.ts`), so tall frames never hit the max texture
size. Detail layers live in `GpuScene` over the base sprite; the base stays
while zooming. Off-screen or zoomed-out tiles drop their detail; a 192 MB
(desktop) budget caps the cells, phones shoot none.
Discarded: re-shooting the whole frame (hits canvas limits on tall frames).

Landing frames are motion frames painted from a 480 px poster
(`POSTER_WIDTH`), the dominant cause of the blur at zoom. A motion frame
whose poster is under 1/1.5 of the screen pixels (`softPosters`, view
settled 200 ms, max 3, largest on screen first) is promoted to the live
DOM path in `domIds`, which stays vector-crisp at any zoom. Verified on
the heavy canvas copy at 400%: before/after in feega-videos/shots.
