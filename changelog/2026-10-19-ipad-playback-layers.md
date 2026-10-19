# Touch devices keep preview layer hints unless the frame is too big

#857 dropped every `will-change` in the preview iframe on any touch device to stop a 274-clip
landing (1440×4735) from pushing the iPhone GPU process past 1.2 GB. iPads count as touch, so
motion frames on iPad lost their layers too, and playback repainted the whole frame every tick:
reported as unwatchable on iPad Pro.

Now `previewHtml` flattens only when hinted clips × frame area exceeds the device budget
(`layerPixels`: touch 5e8, desktop unbounded). The heavy landing (274 × 1440×4735 ≈ 1.9e9)
stays flat; a 110-clip 1080×1920 motion frame (88 × 2.1e6 ≈ 1.8e8) keeps its layers.

Measured, production build, Playwright WebKit, heavy canvas copy (load 6–40 from other agents;
RSS noisy):

| case | before | after |
|---|---|---|
| iPad Pro 11 motion frame: hinted layers / fps p50 | 0 / 59 | 103 / 59 |
| iPad motion: GPU / WebContent peak | 88–130 / 360–730 MB | 113 / 710 MB |
| iPhone 15 Pro motion: GPU / WebContent | 132 / 1169 MB | 94 / 809 MB |
| iPhone landing open (guard spec, GPU) | 109–213 MB | 189 MB |

Emulation on a Mac does not reproduce the iPad slowdown (59 fps both ways): the proof is the
restored layers, not the fps number. Other playback costs on the Mac: WebContent 22–29% CPU,
GPU process ≤12%, main thread idle in `sample` — no evidence for JS, compose or timeline layout,
so nothing else changed.

Discarded: telling iPad from iPhone (Safari exposes no memory signal; the budget alone separates
the cases); hints only while playing (the landing would still spike).
Guard: `tests/e2e/ipad-playback-fps.spec.ts` (`E2E_HEAVY_PHONE=1`).
