# The layer budget applies on desktop too

Editing the 274-clip landing in desktop WebKit took 1–8 s per change (one run crashed the tab):
the layer budget from #876 left desktop unbounded, so all 274 frame-sized `will-change`
wrappers (1440×4735 each) stayed composited, and every hot patch re-rasterised them, blocking
the main thread for seconds.

`previewHtml` now takes no device: one `LAYER_PIXELS` budget (5e8 hinted clips × frame area)
for every browser. Landings (≈1.9e9) render flat; motion frames (≈1.8e8) keep their layers.
Edits hot-patch (no srcdoc reload), so the flat style stays in place across them.

Desktop WebKit, production build, heavy canvas copy, 6 Offset X nudges on the landing (load
7–20 from other agents):

| | before | after |
|---|---|---|
| edit → preview redrawn, p50 / max | 2.0–4.8 s / 8.1 s | 100–123 ms / 164 ms |
| parent frame gap p95 / max | 2.5–3.0 s / 5.6 s | 19 ms / 81 ms |
| GPU process peak | 510–929 MB | 186 MB |
| iPad motion playback (`ipad-playback-fps`) | 103 layers, 59 fps | unchanged |
| iPhone landing open (`phone-heavy-frame-memory`) | 189 MB | 152 MB |

Guard: `tests/e2e/landing-edit-latency.spec.ts` (`E2E_HEAVY_PHONE=1`, p50 ≤ 500 ms): 4.8 s
before, 100 ms after. Shared helpers moved to `tests/e2e/fixtures/heavy-canvas.ts`.
