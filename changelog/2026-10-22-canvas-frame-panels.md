# Editor-only panels move to the canvas Properties tab

The motion editor page is being removed; these lived only there.

- `FrameInspectorPanel`: no element picked → `DocFields` + `CameraInspector` (frame view).
  `Device3D`/`Particles` → `DevicePresets`/`ParticlePresets` (one table, `CLIP_PRESETS`).
  A picked poster part → `PosterPartPanel` as the inspector `lead`.
- GpuFlow publishes a session also when one frame tile is selected (not only with picks), and
  keeps the poster part picked from Layers (`videoSide` gained `part`/`selectPart` hooks;
  before, `selectPart` dropped the part).
- `?` is a canvas command (`help`) in `shortcuts.ts`; `canvasGuide` groups
  `CANVAS_SHORTCUTS` for `ShortcutHelp`, which now takes `sections` (icons optional).
  Mounted once on the canvas page as `CanvasShortcutHelp`.
- DocFields had no counterpart in Properties, so nothing merged.
