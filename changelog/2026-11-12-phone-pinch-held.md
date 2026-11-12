# Phones zoom held pictures, not live pages

Signal: users report the canvas tab dying on iPhone and iPad "as soon as I
move or zoom". WebKit iPhone emulation on the landings fixture: a two-finger
touch pan uploaded ~110 MB of GL textures a frame (~280 ms a frame), 21k
textures in one second on iPhone, 55k on iPad; a wheel pan 0.1 MB.

Cause: the two fingers' moves arrive as separate events, so every touch pan
also changes zoom by a hair. Any zoom change puts frames on the zoom-cache
path, and on a phone (`pictureSide` 2048) frames not held as textures are
re-rastered — vello_hybrid re-creates its 16384-wide data textures each time.

Change: a phone's budget says `zoomPicture: Held`. While a zoom gesture runs,
every drawn frame is held as a texture (the same mechanism a drag uses, capped
at `pictureSide`), and the exact picture comes back when the gesture ends.
Desktop keeps `Exact` (guarded by the desktop-profile test).

Measured (WebKit, local mode, landings, alternating runs, MB uploaded a frame):

| gesture | before | after |
|---|---|---|
| iPhone two-finger pan, 5 runs | 99–114 (16.5 s for 60 frames) | 8–14 (2.8 s) |
| iPhone pinch-in, 6 runs | 15–33 | 7–17 |
| iPad two-finger pan, 4 runs | 6, 8, 227, 450 | 37, 43, 44, 95 |

On iPad the worst case drops 5x but the good case rises; the guard's iPad
budget (120 MB a frame) is set to the after numbers, not to an ideal.

Not covered: the first recorded phone death (2026-11-12 18:06Z) was a pure
pan at zoom 0.05 with no zoom change; this change does not touch that path,
and a WebGPU pure-pan probe shows identical numbers before and after.

Guard: `npm run perf:phone-guard` (WebKit, iPhone and iPad profiles, against
a running local-mode server, `BASE=`) fails over the per-frame budget, on a
page crash, on `core off`, or if the canvas does not come back after
`WEBGL_lose_context`.
