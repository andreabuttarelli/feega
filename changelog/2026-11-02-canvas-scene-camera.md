# The canvas draws frames through the scene camera

A frame with a camera (`doc.camera`) rendered correctly in exports and in the HTML
player (`composeHtml` puts every world-space clip — text, shapes, images, video, custom
components — in `#world`), but the infinite canvas draws frames on the GPU
(`displayListAt`), and that path ignored the camera. A push-in showed nothing while
editing; an agent building a trailer faked the move with per-layer `rotateX/rotateY`.

`stageLenses` (`gpu-full/depth.ts`) builds, per flat stage layer, the same matrices the
HTML stage sets (`perspective` · `world` · `translate3d(-depth) scale(compensation)`),
from `cameraMath`; `drawFrame` passes it to `depthOf`, so the layer warps like any 3D
turned clip. Guard: `gpu-full/stage-camera.test.ts`.

The motion prompt and `set_camera` / `set_clip_depth` descriptions now say one camera
drives every clip type and that scene moves are camera moves.

Not done: depth of field blur, stage lights and billboard (3D component) layers on the
GPU canvas; exports draw them. A turned clip in the world is composed in 3D instead of
flattened into its layer first, which can differ slightly from the export.
