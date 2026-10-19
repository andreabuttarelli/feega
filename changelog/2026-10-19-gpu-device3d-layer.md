# Device3D drawn by gpu-full as a layer of the HTML engine's three.js canvas

Before: Device3D was an unsupported component in gpu-full and the core, and its screen
composition's clips were drawn flat on the frame.

Now Device3D is read like a Custom component: the sandboxed DOM reader composes only the device
clips (plus their screen clips) with the HTML engine's three.js runtime, and its canvas comes
back as a `layer` item. Screen clips are no longer drawn on the frame.

Fixes found on the way:
- the probe now seeks through the player (`renderSeek`), so clip visibility follows the time;
  `tl.seek` alone left every clip that does not start at 0 hidden.
- the probe waits for `__hf.buildReady` (models, environment).
- a root `z-index` no longer refuses the whole tree: it only orders the clip among clips.
- custom layer pictures reported 0×0 (size read after the bitmap was transferred), so the core
  drew no custom canvas at all; layers now reach the core as pictures and re-upload every frame.

Still named, not drawn: the screen composition (DOM on a projective 3D face,
`screen composition on a 3D face`). Device frames on 94c3637f: SSIM 0.87–0.95, residue is the
empty screen. Discarded for now: porting the device geometry and PBR shading to the core.
