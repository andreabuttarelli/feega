# snapcn templates: GPU export fixes and feega branding

A GPU-versus-HTML pixel sweep over all 61 snapcn templates (defaults, plus 21 with every media field filled) found why some exported blank or wrong.

- **card-rail and roster-grant exported black.** Vello drops a whole frame when it runs out of tile buffer (2^21 entries). Every item under an `overflow: hidden` box carried that box as its own clip, so text-heavy components pushed hundreds of identical full-frame clips. `scene.rs` now shares one clip push across consecutive items with equal covers (like scissors already were), and the vendored `vello_encoding` tile buffer is doubled to 2^22. Checked at 720p, 1080p and 4K.
- **Picked media spilled out of laptop-frame's screen.** Layers read from a custom component lost their masks in `display-list.ts`; under the tilted lid a picture is cut into tiles held by masks, so each tile drew the whole picture.
- **`translate`, `rotate`, `scale` were ignored by the DOM reader.** Only `transform` was composed; ports positioned with the individual properties drew unshifted and unscaled. They are now read and composed with the transform origin.
- **laptop-frame's notch was hidden.** The reader stacks siblings only; its `z-index` sat under a static wrapper. The wrapper is now the stacking layer.
- **sky-lockup with no sky failed the HTML capture** on a hidden `<img>` without a source; it now draws none. A sweep test checks every template for empty pictures.

Templates that use effects the GPU reader declares unsupported (blend modes, CSS filters on some nodes, `background` with images, masks) still export through the HTML renderer, as designed: 15 of 61 at defaults.

Branding: defaults showed the snapcn name, URL, handle, icon and wordmark. They show feega now: the mark traced from `static/icon-512.png`, shared through the kit (`S.mark`, `S.markSrc` as the default logo), a BDO Grotesk "feega" wordmark in cut-lockup, `feega.app` and feega copy. `builtin:snapcn-*` ids and internal names stay so saved documents resolve. A catalog test fails if "snapcn" reappears in a title, description, default or drawing code.
