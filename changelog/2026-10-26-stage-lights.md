# Lights for flat layers in the camera world

T13 of the AE parity list: the camera and depth of field existed, lights did not. `Light` is a clip (component, no pixels) with `kind` ambient/point/spot/parallel, `color`, `intensity`, `falloff`, `coneAngle`, `coneFeather`; position from transform x/y plus clip `depth`, aim from `rotateX`/`rotateY`. All in `ANIMATABLE`, colour interpolated linearly. It is a clip, not a `look.lights` entry: those are three.js lights of 3D clips (`set_light`) and stay as they are.

Shading lives in `cameraMath.frameAt` (`lights.ts` holds the model), so the editor preview and the export read one result: per layer, Lambert from the layer's own rotate X/Y/Z, scalar per layer, not per pixel. The stage script applies it as an SVG colour-matrix filter next to the DoF blur. Like After Effects, once a light is active a layer no light reaches is black. `acceptsLights` (optional on the clip, default on) opts a layer out; 3D clips are never shaded here.

Discarded: per-pixel normals and light-cast shadows (the ticket's second half), colour keyframes with eases (linear only), a separate `doc.lights` array (the ANIMATABLE table and the timeline already handle clips). The GPU display-list path draws no camera stage, so it has no lights either.

Agent: `set_stage_light` (add or change), `accepts_lights` on `set_clip_depth`. UI: Lights section in the frame inspector, "Accepts lights" in a layer's 3D section.
