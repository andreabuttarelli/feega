# Experiment B — Flutter + native gpu-core (wgpu → Metal)

Machine: Apple Silicon, 120 Hz display. Canvas 2024×1634 px (1012×817 pt @2×).
Document: `native-bench/scene.json` (44 frames, 128 groups, 4743 nodes, text pre-flattened to paths, 120 image items).
Script: `native-bench/METHOD.md`. Raw data: `results.json`, `samples.txt` (Flutter); Chrome harness in `../web/`.

## Wiring
`spikes/flutter-native-canvas/` (branch `spike/flutter-native-canvas`):
- `native/`: Rust cdylib on `packages/gpu-core` (Library + Engine, unchanged). It renders into an Rgba8 work texture, then `wgpu::util::TextureBlitter` copies that into a BGRA `MTLTexture` created **from an IOSurface** (`newTextureWithDescriptor:iosurface:plane:` → wgpu-hal `texture_from_raw` → `create_texture_from_hal`). No CPU copy.
- `app/macos/Runner/MainFlutterWindow.swift`: a `FlutterTexture` backed by an IOSurface `CVPixelBuffer`. A method channel passes its IOSurface pointer to Dart.
- `app/lib/`: the Flutter UI (toolbar, Layers, Properties, dark feega tokens), the `Texture` widget, pan/zoom/select/drag in Dart, the scripted bench and an offline recorder. Dart calls Rust through `dart:ffi` (3 C functions), **not** flutter_rust_bridge. With only 3 calls, codegen would add a toolchain without saving any work. Use frb once the API grows.

## Numbers (fps on a 120 Hz display; render = Rust CPU time plus GPU wait, per frame)

| Phase | Flutter native fps | p95 interval | render p50/p95 | Chrome web canvas (gpu-core wasm, WebGPU) fps | p95 interval |
|---|---|---|---|---|---|
| Overview (all frames) | 11 | 200 ms | 80 / 107 ms | 8 | 217 ms |
| Pan (zoom 0.25) | 106 | 8.3 ms | 3.0 / 5.6 ms | 98 | 15.4 ms |
| Zoom 0.05→4→0.05 | 43 | 67 ms | 13 / 46 ms | 100 | 10.2 ms |
| Motion | 116 | 8.3 ms | 3.4 / 6.3 ms | 24 | 163 ms (max 1.5 s) |
| First frame | 8.2 s from launch | | | 10.9 s from navigation | |

- Memory (Flutter, idle after the bench): phys_footprint 236 MB, peak 256 MB. RSS peaked at about 525 MB during load, because the 51 MB JSON is parsed twice. Chrome memory was not measured.
- CPU (Flutter, `ps`): 35–55 % during pan, 75–90 % during zoom, about 40 % during motion, and **about 100 % at rest**. It repaints on every vsync while motion plays, with no idle detection. GPU (`ioreg` Device Utilization): 55–57 % pan, 26–46 % zoom, 54–58 % motion.
- Text: sharp at 0.25, 1 and 4 (`zoom-*.png`). It is re-rasterised per LOD step, so there is no upscaled blur once the camera stops. The native path re-rasters synchronously during zoom, which gives 43 fps. The web path reprojects stale rasters instead: briefly blurry, but 100 fps.
- Motion: smooth natively (116 fps). On the web it drops to 24 fps because every `patch_uses` invalidates the retained cache.

## Reading
- Pan: native and web are equal. Native wins clearly on motion and on first frame.
- Native loses on zoom only because the spike calls plan + hold + draw synchronously every frame, without `compositor.rs` (reprojection, time budget). A native `Painter` for the compositor should close the gap. It is work to do, not a blocker.
- Overview is slow on both (about 100 ms to raster 128 groups at a tiny LOD). That is an engine problem, not a platform one.

## What does not work / shortcuts
- One shared IOSurface with no double buffer: tearing is possible (not observed). The render is a blocking FFI call on the UI thread.
- It repaints on every vsync, so the CPU sits at 100 % at rest.
- No editing beyond selecting and dragging frames. No text editing, no real node model. The scene is parsed twice (once in Dart for metadata, once in Rust).
- `screencapture` has no Screen Recording permission, so screenshots and video come from `RepaintBoundary.toImage` inside the app. `pan-zoom.mp4` is rendered offline at 30 fps from the same script: it shows quality, not smoothness. Smoothness is the fps table.
- arm64 dylib only, ad-hoc signature, not notarised. Scene and images are copied into the bundle. iOS/Android/Windows were scaffolded with `flutter create` but are not wired.

## Production estimate (1 engineer, Rust + Flutter)
| Work | Weeks |
|---|---|
| Native compositor (reprojection, budgets), render thread, double buffer, idle | 2–3 |
| Real document model: Supabase/realtime, edit ops, text with gpu-text and fonts, video | 4–6 |
| Whole editor UI rewritten in Flutter (panels, inspector, chat, menus…) | 8–12+ |
| iOS: same IOSurface/Metal path + touch | 1–2 |
| Android: wgpu Vulkan → SurfaceProducer/AHardwareBuffer | 2–3 |
| Windows: wgpu D3D12 → DXGI shared handle (FlutterDesktopGpuSurfaceDescriptor) | 2–3 |
| Per-target Rust CI (cargokit/frb), signing, notarisation, stores | 2 |

The canvas reaches parity in about a month. The real cost is rewriting the whole editor UI in Dart.
