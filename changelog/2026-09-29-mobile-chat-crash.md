# Mobile crash when switching to Chat

**Before:** on iPhone Safari, going Canvas ↔ Chat reloaded the page and then showed "a problem
repeatedly occurred". Every return to the canvas (and every `visibilitychange`) ran `refresh()`,
which replaced all tiles and every override. The snapshot re-signs feed thumbnails and
influencer views, so each switch re-downloaded and re-decoded them, re-rendered every node and
re-posted `estimate_text_cost` for every text node. The canvas was hidden with `display: none`,
so WebKit also tore its layers down and rebuilt them on each show.

**Measured** (dev server, 17 nodes incl. 8 images of 2000px + synced feed, 12-turn thread,
50 toggles, iPhone 390×844 @3x):

| | before | after |
|---|---|---|
| requests per toggle | ~9.6 (4.6 images, 3.4 estimates, 1 snapshot) | 1 (snapshot) |
| WebKit WebContent+GPU RSS | 1250 → 1451 MB, monotonic | 1250 → 957 MB, flat/down |
| Chromium layouts per toggle | ~4.8 | 3 |

No navigation or reload on toggle in either run.

**Now:** `keepSame` (`src/lib/canvas/snapshot-keep.ts`) keeps what is shown when the refetch
differs only by Storage signatures; an expired signature still gets renewed. The hidden canvas
uses `visibility: hidden`.

**Left:** image tiles load the original file (2000px ≈ 16 MB decoded each). The WebKit baseline
is ~1 GB with 20 images; serving a preview size would cut it.
