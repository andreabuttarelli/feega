# Opening a heavy frame on a phone: no full-frame GPU layers

On iPhone Safari the heavy canvas opened (#841), then the page died as soon as a landing frame
(274 clips, 1440×4735) opened in the inline editor.

Measured in Playwright WebKit, iPhone 15 Pro (DPR 3), production build, `ps` RSS of the WebKit
GPU process: opening that frame spiked it to 1.26–1.88 GB. The cause is the preview iframe, not
the timeline: every clip wrapper (`.fx`, `.kf`, `.ks`) is `inset: 0` with `will-change`, so each
one is a frame-sized composited layer at DPR 3. Hiding the player took the spike to ~730 MB;
turning `will-change` off inside the iframe took it to ~230 MB. Opening the timeline itself
(motion frame, 35 clips) added ~1 MB; landing frames show no timeline on a phone (Design only),
and timeline rows are already windowed (#851).

Now the memory budget table has `layerHints`: false on a phone, where `previewHtml` adds
`*{will-change:auto!important}` to the player's srcdoc — the approach the device-screen and ring
copies already use. Cost: on a phone, playback repaints instead of moving layers.

| GPU process peak, opening the landing | runs |
|---|---|
| before | 1260, 1287, 1291, 1736, 1878 MB |
| after | 109, 109, 113, 213 MB |

WebContent stayed ~650–710 MB. Guard: `tests/e2e/phone-heavy-frame-memory.spec.ts`
(`E2E_HEAVY_PHONE=1`, test account, limit 800 MB).

Not done: GPU canvas textures stay while the editor is open (~80 MB, not the spike); filmstrip
and waveform caps (the heavy frames have no video clips to measure them on).
