# Play matches the canvas

Play rendered differently from the canvas for three reasons:

1. **Renderer fallback.** `MotionPreview` asked for `gpu-core` (WebGPU) and on failure went
   straight to the HTML player. The canvas steps WebGPU → WebGL core. Without WebGPU (Safari,
   headless Chromium) Play showed the HTML player: black for the base view in the parity bench.
   `fallbackOf` in `engine-flag.ts` is now the one chain: core → core-gl → HTML. A late failure
   from an unmounted layer is ignored.
2. **Time.** Play autoplayed from frame 0; the canvas draws `frameOfLive` (the poster frame).
   Play now holds the same still frame, and hotspots use shaped text instead of the estimate.
3. **View height.** `docAtWidth` forced the base height onto a breakpoint view; a hug-height view
   (features grid, phone) was squeezed. At a view's own width it is now exactly `resolveView`.

Responsive: Play opens in Responsive following the window (`WidthSource.Window`); `viewChoices`
lists Desktop/Tablet/Mobile plus the frame's views. Header: `FrameBadge.Play` is the first row of
`frameHeaderIcons`, on every frame; the prototype-only badge is gone.

Parity: `tests/e2e/canvas-play-parity.spec.ts` (`E2E_REAL_STACK=1`) compares canvas tiles with
Play per view, SSIM ≥ 0.98. Before: base views 0.001–0.41. After: 0.993–0.999.

Not fixed: a frame taller than the device's WebGL texture limit is cropped by the core-gl backend
(landing fixture, 4632–6402 px, headless SwiftShader); the fix belongs in the Rust core. No
keyboard shortcut was added: none existed for Play.
